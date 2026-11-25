import {
  formatPrice,
  formatEditionStatus,
  calculateTotal,
  calculateVariantPrice,
  productImageSrc,
  productRawImageSrc,
  collectImageGallery,
  productGalleryImages,
  artworkGalleryImages,
  normalizeProduct,
  normalizeVariant,
  defaultCartItemVariant,
  productHasPurchaseOptions,
  applyEditionInventory,
  normalizeEdition,
  normalizeShipping,
  productAllowsCountry,
  calculateItemShipping,
  allowedCheckoutCountriesForItems,
  describeProductShipping,
  PRODUCT_IMAGE_FALLBACK,
  normalizeCategoryThresholdKey,
  parseLowStockThresholds,
  resolveLowStockThreshold,
  formatLowStockRangeLabel,
  type Product,
} from '@/lib/commerce';
import { humanizeOrderTimelineEntry } from '@/lib/order-status-shared';
import { resolvePublicAssetUrl } from '@/lib/public-asset';
import { normalizeProductPayload, productPayloadSchema } from '@/lib/admin-content';
import { splitPlainParagraphs } from '@/lib/site-content-shared';
import {
  isGifUrl,
  isVideoUrl,
  parseVariantFilename,
  pickVariantUrl,
  shouldUnoptimizeImage,
} from '@/lib/image-variant-url';
import { createCartRecoveryToken, verifyCartRecoveryToken } from '@/lib/cart-recovery';
import { CustomerInsights } from '@/lib/analytics/customer-insights';
import {
  stableSearchParamsKey,
  activeFilterChips,
  removeFilterChip,
  activeFilterCount,
  displayFilterLabel,
} from '@/lib/search-params';
import { applyCommissionIntake } from '@/lib/commission-intake';
import {
  applyBioNarrativePreset,
  bioContainsDemoCredentials,
  detectBioNarrativePreset,
} from '@/lib/bio-narrative';
import {
  applyPortfolioPresentationPreset,
  detectPortfolioPresentationPreset,
} from '@/lib/portfolio-presentation';
import {
  DEFAULT_BIO_PAGE,
  DEFAULT_CONTACT_PAGE,
  DEFAULT_HOME_PAGE,
  DEFAULT_PORTFOLIO_PAGE,
  DEFAULT_SHOP_PAGE,
  DEFAULT_SITE_IDENTITY,
  DEFAULT_SITE_THEME,
  DEFAULT_THEME_PRIMARY_HOVER,
  PAGE_TONES,
  QUIET_SHOP_CATALOG_LIMIT,
  SITE_CONTENT_DEFAULTS,
  SITE_LOOKBOOKS,
  THEME_PALETTES,
  applySiteLookbook,
  detectSiteLookbook,
  ensureContrast,
  mergePortfolioCategoriesFromTags,
  normalizePortfolioCategoryKey,
  portfolioPageSchema,
  resolvePortfolioFilterCategories,
  siteIdentitySchema,
  suggestBrandColorsFromSwatches,
  themeContrastIssues,
  themeCssVariables,
  withReadableBrandColors,
  bioPageSchema,
} from '@/lib/site-content-shared';
import { brandAssetVersion, brandIconPath, brandMonogram } from '@/lib/brand';
import { socialHandle } from '@/lib/seo';
import { isSiteCustomizationComplete } from '@/lib/setup-readiness';
import { InventoryService } from '@/lib/inventory';
import { prisma } from '@/lib/db';
import { isLiveStripePaymentIntent, OrderManager } from '@/lib/orders';
import { orderStatusDescription, orderStatusLabel } from '@/lib/order-status-shared';

describe('Commerce Library', () => {
  const sampleProduct: Product = normalizeProduct({
    id: 'sample',
    title: 'Sample Work',
    description: 'Test',
    price: 500,
    currency: 'USD',
    category: 'paintings',
    medium: 'Oil',
    dimensions: '24x36',
    year: 2024,
    availability: 'available',
    featured: true,
    images: { thumbnail: '', gallery: [] },
    tags: [],
    shipping: { domestic: 25, international: 75 },
    specifications: { framed: false, signed: true, certificate: true },
  });

  describe('formatPrice', () => {
    it('should format price correctly', () => {
      expect(formatPrice(500)).toBe('$500.00');
      expect(formatPrice(1000.50)).toBe('$1,000.50');
    });

    it('should handle different currencies', () => {
      expect(formatPrice(500, 'EUR')).toBe('€500.00');
    });
  });

  describe('calculateTotal', () => {
    it('should calculate total with shipping', () => {
      expect(calculateTotal(500, 25)).toBe(525);
      expect(calculateTotal(200, 15)).toBe(215);
    });
  });

  describe('calculateVariantPrice', () => {
    it('adds variant modifiers to base price', () => {
      expect(calculateVariantPrice(100, { framing: { id: 'f1', name: 'Frame', price: 50 } })).toBe(150);
    });
  });

  describe('productImageSrc', () => {
    it('falls back when images are empty', () => {
      expect(productImageSrc(sampleProduct)).toBe(PRODUCT_IMAGE_FALLBACK);
    });

    it('prefers thumbnail when present', () => {
      expect(productImageSrc({ ...sampleProduct, images: { thumbnail: '/uploads/a.jpg', gallery: [] } })).toBe('/uploads/a.jpg');
    });

    it('uses thumb variant for uploaded images while productRawImageSrc keeps original', () => {
      const uploaded = {
        ...sampleProduct,
        images: { thumbnail: '/uploads/images/abc123.jpg', gallery: [] },
      };
      expect(productImageSrc(uploaded)).toBe('/uploads/images/abc123-thumb.webp');
      expect(productRawImageSrc(uploaded)).toBe('/uploads/images/abc123.jpg');
    });

    it('maps GIFs to static WebP posters for thumbs only, keeps animated GIFs for md/lg, leaves videos raw, and prefers still images for product previews', () => {
      expect(pickVariantUrl('/uploads/images/spin.gif', 'thumb')).toBe('/uploads/images/spin-thumb.webp');
      expect(pickVariantUrl('/uploads/images/spin.gif', 'md')).toBe('/uploads/images/spin.gif');
      expect(pickVariantUrl('/uploads/images/spin.gif', 'lg')).toBe('/uploads/images/spin.gif');
      expect(pickVariantUrl('/uploads/videos/reel.mp4', 'thumb')).toBe('/uploads/videos/reel.mp4');
      expect(shouldUnoptimizeImage('/uploads/images/spin.gif')).toBe(true);
      expect(shouldUnoptimizeImage('https://artist.blob.core.windows.net/assets/images/spin.gif')).toBe(true);

      const videoFirst: Product = {
        ...sampleProduct,
        images: {
          thumbnail: '/uploads/videos/reel.mp4',
          gallery: ['/uploads/videos/reel.mp4', '/uploads/images/still.jpg'],
        },
      };
      expect(productRawImageSrc(videoFirst)).toBe('/uploads/images/still.jpg');
      expect(productImageSrc(videoFirst)).toBe('/uploads/images/still-thumb.webp');
    });

    it.each([
      ['/uploads/videos/clip.mp4', true, false],
      ['/uploads/videos/clip.MOV?v=1', true, false],
      ['https://artist.blob.core.windows.net/assets/videos/demo.webm#t=1', true, false],
      ['/uploads/images/loop.gif', false, true],
      ['/uploads/images/photo.jpg', false, false],
    ])('classifies media URL %s (video=%s, gif=%s)', (url, video, gif) => {
      expect(isVideoUrl(url)).toBe(video);
      expect(isGifUrl(url)).toBe(gif);
    });
  });

  describe('gallery image helpers', () => {
    it('collectImageGallery deduplicates, trims, and falls back when empty', () => {
      expect(collectImageGallery(null, '', '  ')).toEqual([PRODUCT_IMAGE_FALLBACK]);
      expect(
        collectImageGallery('/uploads/a.jpg', [' /uploads/a.jpg ', '/uploads/b.jpg', '', '/uploads/b.jpg']),
      ).toEqual(['/uploads/a.jpg', '/uploads/b.jpg']);
    });

    it('productGalleryImages preserves gallery order (including video-first) while supporting legacy thumbnails', () => {
      const product: Product = {
        ...sampleProduct,
        images: {
          thumbnail: '/uploads/front.jpg',
          gallery: ['/uploads/front.jpg', '/uploads/back.jpg', '/uploads/detail.jpg'],
        },
      };
      expect(productGalleryImages(product)).toEqual([
        '/uploads/front.jpg',
        '/uploads/back.jpg',
        '/uploads/detail.jpg',
      ]);

      const videoFirst: Product = {
        ...sampleProduct,
        images: {
          thumbnail: '/uploads/images/still.jpg',
          gallery: ['/uploads/videos/reel.mp4', '/uploads/images/still.jpg', '/uploads/images/spin.gif'],
        },
      };
      expect(productGalleryImages(videoFirst)).toEqual([
        '/uploads/videos/reel.mp4',
        '/uploads/images/still.jpg',
        '/uploads/images/spin.gif',
      ]);

      const legacyThumb: Product = {
        ...sampleProduct,
        images: {
          thumbnail: '/uploads/images/cover.jpg',
          gallery: ['/uploads/images/detail.jpg'],
        },
      };
      expect(productGalleryImages(legacyThumb)).toEqual([
        '/uploads/images/cover.jpg',
        '/uploads/images/detail.jpg',
      ]);

      expect(productGalleryImages(sampleProduct)).toEqual([PRODUCT_IMAGE_FALLBACK]);
    });

    it('artworkGalleryImages avoids creating a 2-slide carousel for legacy thumbnail + main pairs and preserves video-first galleries', () => {
      expect(
        artworkGalleryImages({
          main: '/images/artworks/piece.jpg',
          thumbnail: '/images/artworks/piece-thumb.jpg',
          gallery: [],
        }),
      ).toEqual(['/images/artworks/piece.jpg']);

      expect(
        artworkGalleryImages({
          main: '/images/artworks/piece.jpg',
          thumbnail: '/images/artworks/piece-thumb.jpg',
          gallery: ['/images/artworks/piece.jpg', '/images/artworks/piece-detail.jpg'],
        }),
      ).toEqual(['/images/artworks/piece.jpg', '/images/artworks/piece-detail.jpg']);

      expect(
        artworkGalleryImages({
          main: '/uploads/images/still.jpg',
          thumbnail: '/uploads/images/still.jpg',
          gallery: ['/uploads/videos/reel.mp4', '/uploads/images/still.jpg', '/uploads/images/spin.gif'],
        }),
      ).toEqual(['/uploads/videos/reel.mp4', '/uploads/images/still.jpg', '/uploads/images/spin.gif']);
    });
  });

  describe('formatEditionStatus', () => {
    it.each([
      [undefined, null],
      [{ total: 0, remaining: 0 }, null],
      [{ total: 25, remaining: 25 }, 'Edition of 25'],
      [{ total: 25, remaining: 8 }, '8 of 25 remaining'],
      [{ total: 25, remaining: 0 }, 'Sold out · Edition of 25'],
      [{ total: 10, remaining: 14 }, 'Edition of 10'],
    ])('formats %p -> %p', (edition, expected) => {
      expect(formatEditionStatus(edition)).toBe(expected);
    });
  });

  describe('normalizeProduct purchase options', () => {
    it('drops empty customization and variant groups', () => {
      const normalized = normalizeProduct({
        ...sampleProduct,
        customizations: [],
        variants: { sizes: [], framing: [], materials: [] },
      });
      expect(normalized.customizations).toBeUndefined();
      expect(normalized.variants).toBeUndefined();
      expect(productHasPurchaseOptions(normalized)).toBe(false);
    });

    it('keeps real framing options', () => {
      const normalized = normalizeProduct({
        ...sampleProduct,
        variants: {
          framing: [{ id: 'frame-1', name: 'White', priceModifier: 120, available: true }],
        },
      });
      expect(normalized.variants?.framing).toHaveLength(1);
      expect(productHasPurchaseOptions(normalized)).toBe(true);
    });

    it('drops blank and whitespace-only size options so Size Options never renders empty labels', () => {
      const normalized = normalizeProduct({
        ...sampleProduct,
        variants: {
          sizes: [
            { id: 'blank', name: '', price: 0 },
            { id: 'spaces', name: '   ', priceModifier: 0 },
            { id: 'collector', name: 'Collector size', price: 40 },
          ],
          framing: [
            { id: 'unframed', name: 'Unframed', price: 0 },
            { id: 'missing-name', name: '', price: 150 },
          ],
        },
        customizations: [
          { id: 'blank-field', name: '  ', type: 'input', required: false },
          {
            id: 'edition',
            name: 'Edition',
            type: 'select',
            required: false,
            options: [
              { id: 'any', name: 'Any', price: 0 },
              { id: 'empty', name: '', price: 5 },
            ],
          },
        ],
      });

      expect(normalized.variants?.sizes).toEqual([
        expect.objectContaining({ id: 'collector', name: 'Collector size', priceModifier: 40 }),
      ]);
      expect(normalized.variants?.framing).toEqual([
        expect.objectContaining({ id: 'unframed', name: 'Unframed', priceModifier: 0 }),
      ]);
      expect(normalized.customizations).toEqual([
        expect.objectContaining({
          id: 'edition',
          name: 'Edition',
          options: [{ id: 'any', name: 'Any', price: 0 }],
        }),
      ]);
      expect(productHasPurchaseOptions(normalized)).toBe(true);
    });

    it('drops a size group that only contains blank options', () => {
      const normalized = normalizeProduct({
        ...sampleProduct,
        variants: {
          sizes: [{ id: 'ghost', name: '', priceModifier: 0 }],
          framing: [{ id: 'unframed', name: 'Unframed', price: 0 }],
        },
      });
      expect(normalized.variants?.sizes).toBeUndefined();
      expect(normalized.variants?.framing).toHaveLength(1);
    });
  });

  describe('normalizeVariant and defaultCartItemVariant', () => {
    it('rejects nameless variants and derives an id when missing', () => {
      expect(normalizeVariant({ name: '', price: 0 })).toBeNull();
      expect(normalizeVariant({ name: '  Large print  ', price: 40 })).toEqual({
        id: 'large-print',
        name: 'Large print',
        description: undefined,
        priceModifier: 40,
        available: true,
        stock: undefined,
      });
    });

    it('defaults each group to the included in-stock choice', () => {
      const product = normalizeProduct({
        ...sampleProduct,
        variants: {
          sizes: [
            { id: 'large', name: 'Large', priceModifier: 40, available: true },
            { id: 'standard', name: 'Standard', priceModifier: 0, available: true },
          ],
          framing: [{ id: 'unframed', name: 'Unframed', price: 0 }],
        },
      });
      expect(defaultCartItemVariant(product)).toEqual({
        size: { id: 'standard', name: 'Standard', price: 0 },
        framing: { id: 'unframed', name: 'Unframed', price: 0 },
      });
    });
  });
});

describe('normalizeProductPayload purchase options', () => {
  it('persists framing options and clears empty commission blocks', () => {
    const payload = normalizeProductPayload({
      title: 'Studio Print',
      description: 'Test',
      price: 120,
      currency: 'USD',
      category: 'prints',
      medium: 'Ink',
      dimensions: '16x20',
      year: 2024,
      availability: 'available',
      featured: false,
      images: { thumbnail: '/images/shop/placeholder-7.jpg', gallery: [] },
      tags: [],
      shipping: { domestic: 10, international: 25 },
      specifications: { framed: false, signed: true, certificate: true },
      variants: {
        framing: [{ id: 'frame-1', name: 'White', priceModifier: 60, available: true }],
      },
      customizations: [],
      commissionInfo: { available: false, estimatedDays: 30, priceRange: { min: 0, max: 0 }, requiresConsultation: false },
    });
    expect(payload.variants?.framing).toHaveLength(1);
    expect(payload.customizations).toEqual([]);
    expect(payload.commissionInfo).toBeNull();
  });

  it('strips blank size options on admin save so they never reach the storefront', () => {
    const payload = normalizeProductPayload({
      title: 'Urban Twilight',
      description: 'Test',
      price: 850,
      currency: 'USD',
      category: 'paintings',
      medium: 'Oil',
      dimensions: '24x36',
      year: 2024,
      availability: 'available',
      featured: true,
      images: { thumbnail: '/images/shop/placeholder-1.jpg', gallery: [] },
      tags: [],
      shipping: { domestic: 25, international: 75 },
      specifications: { framed: false, signed: true, certificate: true },
      variants: {
        sizes: [{ id: 'sizes-abc', name: '', priceModifier: 0, available: true }],
        framing: [
          { id: 'unframed', name: 'Unframed', priceModifier: 0, available: true },
          { id: 'collector-misfiled', name: 'Collector size', priceModifier: 40, available: true },
        ],
      },
      customizations: [],
    });
    expect(payload.variants?.sizes).toBeUndefined();
    expect(payload.variants?.framing).toHaveLength(2);
  });
});

describe('image variant urls', () => {
  it.each([
    ['/uploads/images/photo.jpg', 'md', '/uploads/images/photo-md.webp'],
    ['/uploads/images/photo-thumb.webp', 'lg', '/uploads/images/photo-lg.webp'],
    [
      'https://myaccount.blob.core.windows.net/artist-site-assets/images/abc123.png',
      'md',
      'https://myaccount.blob.core.windows.net/artist-site-assets/images/abc123-md.webp',
    ],
    [
      'https://myaccount.blob.core.windows.net/artist-site-assets/images/abc123-thumb.webp?v=2',
      'lg',
      'https://myaccount.blob.core.windows.net/artist-site-assets/images/abc123-lg.webp?v=2',
    ],
    [
      'https://myaccount.blob.core.windows.net/artist-site-assets/images/spin.gif',
      'thumb',
      'https://myaccount.blob.core.windows.net/artist-site-assets/images/spin-thumb.webp',
    ],
    [
      'https://myaccount.blob.core.windows.net/artist-site-assets/videos/reel.mp4',
      'thumb',
      'https://myaccount.blob.core.windows.net/artist-site-assets/videos/reel.mp4',
    ],
    [
      'https://cdn.example.com/images/external.jpg',
      'md',
      'https://cdn.example.com/images/external.jpg',
    ],
  ] as const)('maps %s (%s) -> %s', (input, size, expected) => {
    expect(pickVariantUrl(input, size)).toBe(expected);
  });

  it.each([
    ['abc123-thumb.webp', { stem: 'abc123', size: 'thumb' }],
    ['abc123-md.webp', { stem: 'abc123', size: 'md' }],
    ['abc123-lg.webp', { stem: 'abc123', size: 'lg' }],
    ['abc123.webp', null],
    ['abc123.jpg', null],
  ])('parses generated variant filename %s', (filename, expected) => {
    expect(parseVariantFilename(filename)).toEqual(expected);
  });

  it.each([
    ['/images/portfolio/piece.jpg', false],
    ['/uploads/images/abc123.jpg', false],
    ['/uploads/images/abc123-md.webp', true],
    ['https://myaccount.blob.core.windows.net/assets/images/abc.jpg', false],
    ['https://myaccount.blob.core.windows.net/assets/images/abc-thumb.webp', true],
    ['https://myaccount.blob.core.windows.net/assets/images/abc-lg.webp', true],
    ['/images/fallback-artwork.svg', true],
    ['https://cdn.example.com/painting.jpg', true],
    ['data:image/png;base64,abc', true],
  ])('computes shouldUnoptimizeImage(%s) -> %s', (src, expected) => {
    expect(shouldUnoptimizeImage(src)).toBe(expected);
  });
});

describe('resolvePublicAssetUrl', () => {
  it('falls back for missing local public files', () => {
    expect(resolvePublicAssetUrl('/images/portfolio/does-not-exist.jpg')).toBe(PRODUCT_IMAGE_FALLBACK);
  });

  it('keeps existing local public files', () => {
    expect(resolvePublicAssetUrl('/images/fallback-artwork.svg')).toBe('/images/fallback-artwork.svg');
    expect(resolvePublicAssetUrl('/images/portfolio/golden-hour-thumb.jpg')).toBe(
      '/images/portfolio/golden-hour-thumb.jpg',
    );
  });

  it('passes remote urls through unchanged', () => {
    expect(resolvePublicAssetUrl('https://cdn.example.com/art.jpg')).toBe('https://cdn.example.com/art.jpg');
  });
});

describe('cart recovery tokens', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret-for-cart-recovery-tokens';
  });

  afterAll(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  it('round-trips cart payload', () => {
    const token = createCartRecoveryToken([], 'buyer@example.com');
    const payload = verifyCartRecoveryToken(token);
    expect(payload?.email).toBe('buyer@example.com');
    expect(payload?.items).toEqual([]);
  });
});

describe('search params helpers', () => {
  it('builds stable keys regardless of param order', () => {
    expect(stableSearchParamsKey(new URLSearchParams('sort=price&page=2'))).toBe('page=2&sort=price');
    expect(stableSearchParamsKey(new URLSearchParams('page=2&sort=price'))).toBe('page=2&sort=price');
  });

  it.each([
    ['light-studies', 'Light Studies'],
    ['night-series', 'Night Series'],
    ['abstract', 'Abstract'],
    ['mixed_media', 'Mixed Media'],
    ['Oil on canvas', 'Oil On Canvas'],
  ])('displayFilterLabel(%s) → %s', (input, expected) => {
    expect(displayFilterLabel(input)).toBe(expected);
  });

  it('lists and removes active filter chips', () => {
    const params = new URLSearchParams('categories=paintings,prints&medium=oil&priceMin=500&priceMax=1000');
    const chips = activeFilterChips(params);
    expect(chips).toHaveLength(4);
    expect(activeFilterCount(params)).toBe(4);
    const next = removeFilterChip(params, 'medium:oil');
    expect(next).toContain('categories=paintings');
    expect(next).not.toContain('medium=oil');
  });
});

describe('commission intake wizard', () => {
  it('applies enabled inquiry types in recommended order', () => {
    const next = applyCommissionIntake(DEFAULT_CONTACT_PAGE, ['commission', 'purchase']);
    const visible = next.form.inquiryTypes.filter((item: { visible: boolean }) => item.visible);
    expect(visible.map((item: { key: string }) => item.key)).toEqual(['purchase', 'commission']);
    expect(next.sidebar.commissionHtml).toContain('commission projects');
  });
});

describe('inventory purchasability', () => {
  it.each([
    {
      name: 'untracked available',
      availability: 'available',
      inventory: null,
      expected: true,
    },
    {
      name: 'sold blocks',
      availability: 'sold',
      inventory: null,
      expected: false,
    },
    {
      name: 'tracked out of stock',
      availability: 'available',
      inventory: {
        productId: 'p1',
        currentStock: 0,
        availableStock: 0,
        reservedStock: 0,
        stockStatus: 'out_of_stock' as const,
        lowStockThreshold: 1,
        allowBackorders: false,
      },
      expected: false,
    },
    {
      name: 'tracked with stock',
      availability: 'available',
      inventory: {
        productId: 'p1',
        currentStock: 3,
        availableStock: 3,
        reservedStock: 0,
        stockStatus: 'in_stock' as const,
        lowStockThreshold: 1,
        allowBackorders: false,
      },
      expected: true,
    },
  ])('$name', ({ availability, inventory, expected }) => {
    expect(InventoryService.isPurchasableFromStatus(availability, inventory)).toBe(expected);
  });
});

describe('order status copy', () => {
  it.each([
    ['pending', 'Pending', 'Order placed and payment pending'],
    ['shipped', 'Shipped', 'Order has been shipped'],
    ['refunded', 'Refunded', 'Order has been refunded'],
  ] as const)('labels %s for collectors and artists', (status, label, description) => {
    expect(orderStatusLabel(status)).toBe(label);
    expect(orderStatusDescription(status)).toBe(description);
    expect(OrderManager.getStatusMessage(status)).toBe(description);
  });
});

describe('edition inventory overlay', () => {
  it('caps remaining to live available stock', () => {
    expect(normalizeEdition({ total: 50, remaining: 23 })).toEqual({ total: 50, remaining: 23 });
    const product = normalizeProduct({
      id: 'edition-print',
      title: 'Edition Print',
      description: 'Limited',
      price: 120,
      currency: 'USD',
      category: 'prints',
      medium: 'Print',
      dimensions: '16x20',
      year: 2024,
      availability: 'available',
      featured: false,
      images: { thumbnail: '/images/shop/placeholder-7.jpg', gallery: [] },
      tags: [],
      shipping: { domestic: 10, international: 25 },
      specifications: { framed: false, signed: true, certificate: true },
      edition: { total: 50, remaining: 23 },
    });
    expect(applyEditionInventory(product, 12).edition).toEqual({ total: 50, remaining: 12 });
    expect(applyEditionInventory(product, null).edition).toEqual({ total: 50, remaining: 23 });
  });
});

describe('refund and payment intent gates', () => {
  it.each([
    ['pi_3Abc', true],
    ['e2e_payment_order1', false],
    [null, false],
  ] as const)('isLiveStripePaymentIntent(%p) -> %p', (id, expected) => {
    expect(isLiveStripePaymentIntent(id)).toBe(expected);
  });

  it('requires paid paymentStatus before refund eligibility', () => {
    const base = {
      id: 'o1',
      orderNumber: 'ORD-1',
      type: 'standard' as const,
      status: 'confirmed' as const,
      customerEmail: 'a@b.com',
      items: [],
      subtotal: 10,
      shipping: 0,
      tax: 0,
      total: 10,
      currency: 'USD',
      shippingAddress: {
        firstName: 'A', lastName: 'B', address1: '1', city: 'X', state: 'Y', postalCode: '1', country: 'US',
      },
      paymentStatus: 'pending',
      timeline: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(OrderManager.canRefundOrder(base)).toBe(false);
    expect(OrderManager.canRefundOrder({ ...base, paymentStatus: 'paid' })).toBe(true);
    expect(OrderManager.canRefundOrder({ ...base, paymentStatus: 'paid', status: 'pending' })).toBe(false);
  });
});

describe('site theme utilities', () => {
  it('ships neutral charcoal defaults that pass contrast', () => {
    expect(DEFAULT_SITE_IDENTITY.theme).toEqual(DEFAULT_SITE_THEME);
    expect(DEFAULT_SITE_THEME).toMatchObject({
      primaryColor: '#111827',
      accentColor: '#374151',
      fontPreset: 'system',
      cardStyle: 'studio',
      pageTone: 'soft',
    });
    expect(themeContrastIssues(DEFAULT_SITE_THEME)).toEqual([]);
  });

  it('flags unreadable brand colors and suggests deepened versions that pass', () => {
    const theme = { ...DEFAULT_SITE_THEME, primaryColor: '#fde047', accentColor: '#7dd3fc' };
    const issues = themeContrastIssues(theme);
    expect(issues.map((issue) => issue.role)).toEqual(['primary', 'accent']);
    const readable = withReadableBrandColors(theme);
    expect(themeContrastIssues(readable)).toEqual([]);
    expect(issues.map((issue) => issue.suggestion)).toEqual([readable.primaryColor, readable.accentColor]);
  });

  it('leaves already readable colors unchanged', () => {
    expect(ensureContrast('#1a3a82', '#ffffff')).toBe('#1a3a82');
  });

  it('emits RGB channels, surfaces, fonts, and shape tokens', () => {
    const vars = themeCssVariables({ ...DEFAULT_SITE_THEME, cardStyle: 'bold', pageTone: 'warm', fontPreset: 'editorial' });
    expect(vars['--color-primary-rgb']).toBe('17 24 39');
    expect(vars['--color-primary-hover']).toBe(DEFAULT_THEME_PRIMARY_HOVER);
    expect(vars['--surface-page']).toBe(PAGE_TONES.warm.page);
    expect(vars['--surface-muted-rgb']).toBe('244 238 228');
    expect(vars['--radius-button']).toBe('9999px');
    expect(vars['--font-heading']).toContain('--font-fraunces');
    expect(vars['--font-site']).toContain('--font-inter');
    expect(themeCssVariables({ ...DEFAULT_SITE_THEME, cardStyle: 'gallery' })['--radius-input']).toBe('0px');
  });

  it('reads identities saved before page tone, logo, and the retired "modern" preset', () => {
    const savedBeforeLogo: Record<string, unknown> = { ...DEFAULT_SITE_IDENTITY };
    delete savedBeforeLogo.logoImage;
    const identity = siteIdentitySchema.parse({
      ...savedBeforeLogo,
      theme: { primaryColor: '#111827', accentColor: '#374151', fontPreset: 'modern', cardStyle: 'studio', spacingDensity: 'comfortable' },
    });
    expect(identity.logoImage).toBe('');
    expect(identity.theme).toMatchObject({ fontPreset: 'system', pageTone: 'soft', artworkPalette: { image: '', swatches: [] } });
  });

  it.each(SITE_LOOKBOOKS.map((look) => [look.id] as const))('look %s is readable and keeps the saved artwork palette', (id) => {
    const withPalette = { ...DEFAULT_SITE_THEME, artworkPalette: { image: '/uploads/a.jpg', swatches: ['#1a3a82', '#c4451c'] } };
    const next = applySiteLookbook(withPalette, id);
    expect(detectSiteLookbook(next)).toBe(id);
    expect(next.artworkPalette).toEqual(withPalette.artworkPalette);
    expect(themeContrastIssues(next)).toEqual([]);
  });

  it.each(
    THEME_PALETTES.flatMap((palette) => (['white', 'soft', 'warm'] as const).map((pageTone) => [palette.name, pageTone, palette] as const)),
  )('palette %s is readable on %s pages', (_name, pageTone, palette) => {
    expect(themeContrastIssues({ primaryColor: palette.primaryColor, accentColor: palette.accentColor, pageTone })).toEqual([]);
  });

  it('suggests the deepest swatch as main and a vivid, near-readable swatch as highlight', () => {
    expect(suggestBrandColorsFromSwatches(['#c4451c', '#1a3a82', '#f2d16b'])).toEqual({
      primaryColor: '#1a3a82',
      accentColor: ensureContrast('#c4451c', '#ffffff'),
    });
    const pale = suggestBrandColorsFromSwatches(['#f9a8d4', '#a5f3fc']);
    expect(pale && themeContrastIssues({ ...pale, pageTone: 'soft' })).toEqual([]);
    expect(suggestBrandColorsFromSwatches([])).toBeNull();
  });

  it('counts any appearance change or logo as site customization', () => {
    expect(isSiteCustomizationComplete(SITE_CONTENT_DEFAULTS)).toBe(false);
    const withTheme = (theme: typeof DEFAULT_SITE_THEME) => ({
      ...SITE_CONTENT_DEFAULTS,
      identity: { ...SITE_CONTENT_DEFAULTS.identity, theme },
    });
    expect(isSiteCustomizationComplete(withTheme(applySiteLookbook(DEFAULT_SITE_THEME, 'warm-print')))).toBe(true);
    expect(isSiteCustomizationComplete(withTheme({ ...DEFAULT_SITE_THEME, pageTone: 'warm' }))).toBe(true);
    expect(isSiteCustomizationComplete({
      ...SITE_CONTENT_DEFAULTS,
      identity: { ...SITE_CONTENT_DEFAULTS.identity, logoImage: '/uploads/logo.png' },
    })).toBe(true);
  });

  it.each([
    ['https://x.com/studio', '@studio'],
    ['https://twitter.com/studio/', '@studio'],
    ['https://x.com/@studio?ref=site', '@studio'],
    ['https://x.com/', undefined],
    ['not a url', undefined],
    ['', undefined],
  ])('reads the social handle from %p', (profileUrl, handle) => {
    expect(socialHandle(profileUrl)).toBe(handle);
  });

  it('builds brand icon URLs that change only when drawn brand details change', () => {
    expect(brandMonogram('Michal Elena')).toBe('ME');
    expect(brandMonogram('studio')).toBe('S');
    const identity = DEFAULT_SITE_IDENTITY;
    const version = brandAssetVersion(identity);
    expect(brandIconPath(identity, 192)).toBe(`/api/brand/icon?size=192&v=${version}`);
    expect(brandAssetVersion({ ...identity, tagline: 'changed' } as typeof identity)).toBe(version);
    expect(brandAssetVersion({ ...identity, theme: { ...identity.theme, primaryColor: '#1a3a82' } })).not.toBe(version);
    expect(brandIconPath(null, 32)).toBe('/api/brand/icon?size=32');
  });

  it('keeps lean homepage defaults for new sites', () => {
    expect(DEFAULT_HOME_PAGE.newsletter.showSection).toBe(true);
    expect(DEFAULT_HOME_PAGE.blog.showSection).toBe(false);
    expect(DEFAULT_HOME_PAGE.about.showSection).toBe(false);
    expect(DEFAULT_HOME_PAGE.hero.showSecondaryCtas).toBe(false);
    expect(DEFAULT_HOME_PAGE.hero.portraitImage).toBe('');
    expect(DEFAULT_HOME_PAGE.about.studioImage).toBe('');
    expect(DEFAULT_CONTACT_PAGE.portraitImage).toBe('');
    expect(DEFAULT_SHOP_PAGE.showRecommendations).toBe(false);
    expect(DEFAULT_SHOP_PAGE.showRecentlyViewed).toBe(false);
    expect(DEFAULT_SHOP_PAGE.showPurchaseInfo).toBe(false);
    expect(DEFAULT_PORTFOLIO_PAGE.layout.showPrice).toBe(false);
    expect(QUIET_SHOP_CATALOG_LIMIT).toBe(12);
  });

  it('ships statement-first bio defaults without prestige CV filler', () => {
    expect(DEFAULT_BIO_PAGE.showBackground).toBe(false);
    expect(DEFAULT_BIO_PAGE.showAchievements).toBe(false);
    expect(DEFAULT_BIO_PAGE.showCollections).toBe(false);
    expect(DEFAULT_BIO_PAGE.hero.portraitImage).toBe('');
    expect(DEFAULT_BIO_PAGE.hero.subtitle).toBe('');
    expect(DEFAULT_BIO_PAGE.backgroundHtml).toBe('');
    expect(bioContainsDemoCredentials(DEFAULT_BIO_PAGE)).toBe(false);
    expect(detectBioNarrativePreset(DEFAULT_BIO_PAGE)).toBe('statement-first');
  });

  it('clears legacy instructional bio and portfolio subtitles on parse', () => {
    const bio = bioPageSchema.parse({
      ...DEFAULT_BIO_PAGE,
      hero: {
        ...DEFAULT_BIO_PAGE.hero,
        subtitle: 'A short introduction to you and your work. Add a photo when you are ready.',
      },
    });
    expect(bio.hero.subtitle).toBe('');

    const portfolio = portfolioPageSchema.parse({
      ...DEFAULT_PORTFOLIO_PAGE,
      subtitle: 'Selected works. Add categories and choose how images display from Site Content → Portfolio.',
    });
    expect(portfolio.subtitle).toBe('');
    expect(portfolio.layout.includeUnlistedCategories).toBe(false);
  });

  it('applyBioNarrativePreset toggles CV sections and clears demo credentials', () => {
    const prestige = {
      ...DEFAULT_BIO_PAGE,
      showBackground: true,
      showAchievements: true,
      showCollections: true,
      showStudio: true,
      backgroundHtml: '<p>Yale School of Art</p>',
      achievementsHtml: '<p>MoMA PS1</p>',
      collectionsHtml: '<p>Artforum</p>',
      studioPracticeHtml: '<p>Long Island City warehouse</p>',
    };
    expect(bioContainsDemoCredentials(prestige)).toBe(true);

    const statement = applyBioNarrativePreset(prestige, 'statement-first');
    expect(statement.showBackground).toBe(false);
    expect(statement.showAchievements).toBe(false);
    expect(statement.backgroundHtml).toBe('');
    expect(detectBioNarrativePreset(statement)).toBe('statement-first');

    const process = applyBioNarrativePreset(DEFAULT_BIO_PAGE, 'process-led');
    expect(process.showStudio).toBe(true);
    expect(process.showBackground).toBe(false);
    expect(detectBioNarrativePreset(process)).toBe('process-led');

    const cv = applyBioNarrativePreset(DEFAULT_BIO_PAGE, 'cv-traditional');
    expect(cv.showBackground).toBe(true);
    expect(cv.showAchievements).toBe(true);
    expect(cv.showCollections).toBe(true);
    expect(detectBioNarrativePreset(cv)).toBe('cv-traditional');
  });

  it('resolves portfolio filter categories with curated defaults and optional leftovers', () => {
    expect(normalizePortfolioCategoryKey('Works on Paper')).toBe('works-on-paper');
    expect(DEFAULT_PORTFOLIO_PAGE.layout.showPrice).toBe(false);
    expect(DEFAULT_PORTFOLIO_PAGE.layout.includeUnlistedCategories).toBe(false);
    expect(DEFAULT_PORTFOLIO_PAGE.categories).toEqual([]);
    expect(DEFAULT_PORTFOLIO_PAGE.subtitle).toBe('');

    const configured = [
      { key: 'paintings', label: 'Paintings', visible: true },
      { key: 'works-on-paper', label: 'Works on paper', visible: true },
      { key: 'hidden', label: 'Hidden', visible: false },
    ];

    const curated = resolvePortfolioFilterCategories(
      ['drawings', 'paintings', 'commissions', 'Works on Paper'],
      configured,
    );
    expect(curated.map((item) => item.key)).toEqual(['paintings', 'Works on Paper']);
    expect(curated[0].label).toBe('Paintings');
    expect(curated[1].label).toBe('Works on paper');

    const withUnlisted = resolvePortfolioFilterCategories(
      ['drawings', 'paintings', 'commissions'],
      configured,
      { includeUnlisted: true },
    );
    expect(withUnlisted.map((item) => item.key)).toEqual([
      'paintings',
      'works-on-paper',
      'commissions',
      'drawings',
    ]);

    const merged = mergePortfolioCategoriesFromTags(
      [{ key: 'paintings', label: 'Paintings', visible: true }],
      ['paintings', 'night-series', 'Works on Paper'],
    );
    expect(merged.map((item) => item.key)).toEqual(['paintings', 'night-series', 'works-on-paper']);

    const dayOneAuto = resolvePortfolioFilterCategories(
      ['illustration', 'commissions', 'uncategorized'],
      [],
      { includeUnlisted: false },
    );
    expect(dayOneAuto).toEqual([
      { key: 'commissions', label: 'Commissions' },
      { key: 'illustration', label: 'Illustration' },
    ]);
  });

  it('applyPortfolioPresentationPreset sets grid and image framing', () => {
    const quiet = applyPortfolioPresentationPreset(DEFAULT_PORTFOLIO_PAGE, 'quiet-wall');
    expect(quiet.layout.gridColumns).toBe('2');
    expect(quiet.layout.imageFit).toBe('contain');
    expect(quiet.artworkDetailLayout).toBe('gallery-focus');
    expect(detectPortfolioPresentationPreset(quiet)).toBe('quiet-wall');

    const dense = applyPortfolioPresentationPreset(DEFAULT_PORTFOLIO_PAGE, 'dense-catalog');
    expect(dense.layout.gridColumns).toBe('4');
    expect(dense.layout.showMeta).toBe(true);
    expect(detectPortfolioPresentationPreset(dense)).toBe('dense-catalog');
  });
});

describe('Shipping toggles, formatting, and product payload hardening', () => {
  it.each([
    [
      'legacy shipping without booleans enables both lanes',
      { domestic: 6, international: 25 },
      { domesticEnabled: true, internationalEnabled: true, usAllowed: true, caAllowed: true, usFee: 6, caFee: 25 },
    ],
    [
      'US-only shipping disables international countries',
      { domestic: 6, international: 0, domesticEnabled: true, internationalEnabled: false },
      { domesticEnabled: true, internationalEnabled: false, usAllowed: true, caAllowed: false, usFee: 6, caFee: 0 },
    ],
    [
      'pickup-only when both lanes are off',
      { domestic: 0, international: 0, domesticEnabled: false, internationalEnabled: false },
      { domesticEnabled: false, internationalEnabled: false, usAllowed: true, caAllowed: true, usFee: 0, caFee: 0 },
    ],
  ])('%s', (_label, shipping, expected) => {
    const normalized = normalizeShipping(shipping);
    const product = { shipping };
    expect(normalized.domesticEnabled).toBe(expected.domesticEnabled);
    expect(normalized.internationalEnabled).toBe(expected.internationalEnabled);
    expect(productAllowsCountry(product, 'US')).toBe(expected.usAllowed);
    expect(productAllowsCountry(product, 'CA')).toBe(expected.caAllowed);
    expect(calculateItemShipping(product, 'US')).toBe(expected.usFee);
    expect(calculateItemShipping(product, 'CA')).toBe(expected.caFee);
  });

  it('intersects allowed checkout countries across mixed carts and describes shipping clearly', () => {
    const usOnly = { domestic: 6, international: 0, domesticEnabled: true, internationalEnabled: false };
    const both = { domestic: 0, international: 25, domesticEnabled: true, internationalEnabled: true };
    const pickupOnly = { domestic: 0, international: 0, domesticEnabled: false, internationalEnabled: false };

    expect(allowedCheckoutCountriesForItems([{ product: { shipping: usOnly } }, { product: { shipping: both } }])).toEqual({
      countries: ['US'],
      isPickupOnly: false,
      hasConflict: false,
    });
    expect(allowedCheckoutCountriesForItems([{ product: { shipping: pickupOnly } }])).toEqual({
      countries: ['US', 'CA', 'GB', 'AU'],
      isPickupOnly: true,
      hasConflict: false,
    });
    const usOnlyInfo = describeProductShipping({ shipping: usOnly, currency: 'USD' });
    expect(usOnlyInfo.isPickupOnly).toBe(false);
    expect(usOnlyInfo.domesticLabel).toBe('$6.00');
    expect(usOnlyInfo.internationalLabel).toBeNull();
    expect(describeProductShipping({ shipping: pickupOnly, currency: 'USD' }).isPickupOnly).toBe(true);
  });

  it.each([
    ['', []],
    ['Single line', ['Single line']],
    ['First para\n\nSecond para', ['First para', 'Second para']],
    ['First\r\n\r\nSecond\r\nLine 2', ['First', 'Second\nLine 2']],
  ])('splitPlainParagraphs(%j) -> %j', (input, expected) => {
    expect(splitPlainParagraphs(input)).toEqual(expected);
  });

  it('rejects non-positive commission estimatedDays and preserves shipping toggles + initialStock', () => {
    const basePayload = {
      title: 'Summer Meadow',
      price: 30,
      category: 'Prints',
      images: { thumbnail: '/images/test.jpg', gallery: [] },
      specifications: { framed: false, signed: true, certificate: true },
    };

    const bad = productPayloadSchema.safeParse({
      ...basePayload,
      commissionInfo: {
        available: true,
        estimatedDays: -30,
        priceRange: { min: 100, max: 200 },
        requiresConsultation: true,
      },
    });
    expect(bad.success).toBe(false);

    const good = productPayloadSchema.parse({
      ...basePayload,
      shipping: { domestic: 6, international: 0, domesticEnabled: true, internationalEnabled: false },
      initialStock: 10,
    });
    expect(good.initialStock).toBe(10);
    const persisted = normalizeProductPayload(good);
    expect(persisted.shipping).toEqual({
      domestic: 6,
      international: 0,
      domesticEnabled: true,
      internationalEnabled: false,
    });
  });
});

describe('InventoryService.syncProductAlerts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    {
      name: 'resolves all active alerts when restocked to in_stock',
      stock: 10,
      threshold: 5,
      status: 'in_stock' as const,
      existing: [
        { id: 'a1', type: 'low_stock', currentStock: 3, thresholdValue: 5, message: 'old', severity: 'medium', createdAt: new Date() },
      ],
      expectResolveAll: true,
      expectCreateType: null,
      expectUpdateMessage: null,
    },
    {
      name: 'updates existing low_stock alert message in place when quantity changes while staying low',
      stock: 2,
      threshold: 5,
      status: 'low_stock' as const,
      existing: [
        { id: 'a1', type: 'low_stock', currentStock: 4, thresholdValue: 5, message: 'Product stock is low (4 remaining)', severity: 'medium', createdAt: new Date() },
      ],
      expectResolveAll: false,
      expectCreateType: null,
      expectUpdateMessage: 'Product stock is low (2 remaining)',
    },
    {
      name: 'resolves low_stock and creates out_of_stock when quantity drops to 0',
      stock: 0,
      threshold: 5,
      status: 'out_of_stock' as const,
      existing: [],
      expectResolveAll: false,
      expectCreateType: 'out_of_stock',
      expectUpdateMessage: null,
    },
  ])('$name', async ({ stock, threshold, status, existing, expectResolveAll, expectCreateType, expectUpdateMessage }) => {
    const findMany = jest.spyOn(prisma.stockAlert, 'findMany').mockResolvedValue(existing as never);
    const updateMany = jest.spyOn(prisma.stockAlert, 'updateMany').mockResolvedValue({ count: existing.length } as never);
    const update = jest.spyOn(prisma.stockAlert, 'update').mockResolvedValue({} as never);
    const create = jest.spyOn(prisma.stockAlert, 'create').mockResolvedValue({ id: 'created' } as never);

    await InventoryService.syncProductAlerts('prod-1', stock, threshold, status, { sendEmail: false });

    if (expectResolveAll) {
      expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { productId: 'prod-1', isActive: true },
        data: expect.objectContaining({ isActive: false }),
      }));
      expect(create).not.toHaveBeenCalled();
    } else if (expectUpdateMessage) {
      expect(findMany).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({ currentStock: stock, message: expectUpdateMessage }),
      }));
      expect(create).not.toHaveBeenCalled();
    } else if (expectCreateType) {
      expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { productId: 'prod-1', isActive: true, type: { not: expectCreateType } },
        data: expect.objectContaining({ isActive: false }),
      }));
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          productId: 'prod-1',
          type: expectCreateType,
          currentStock: stock,
          severity: 'critical',
        }),
      }));
    }
  });
});

describe('CustomerInsights.getOrderCommerceMetrics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    {
      name: 'returns zeroes when there are no paid orders',
      orders: [],
      expected: {
        paidOrderCount: 0,
        totalRevenue: 0,
        uniqueCustomers: 0,
        averageLTV: 0,
        medianLTV: 0,
        repeatCustomers: 0,
      },
    },
    {
      name: 'computes revenue, average LTV, median LTV, and repeat buyers from paid orders',
      orders: [
        { userId: 'u1', userEmail: 'Alice@Example.com', total: 100 },
        { userId: 'u1', userEmail: 'alice@example.com', total: 200 },
        { userId: null, userEmail: 'bob@example.com', total: 60 },
        { userId: null, userEmail: 'carol@example.com', total: 140 },
      ],
      expected: {
        paidOrderCount: 4,
        totalRevenue: 500,
        uniqueCustomers: 3,
        averageLTV: 500 / 3,
        medianLTV: 140,
        repeatCustomers: 1,
      },
    },
    {
      name: 'computes even-count median LTV across two distinct buyers',
      orders: [
        { userId: 'u1', userEmail: 'a@test.com', total: 40 },
        { userId: 'u2', userEmail: 'b@test.com', total: 100 },
      ],
      expected: {
        paidOrderCount: 2,
        totalRevenue: 140,
        uniqueCustomers: 2,
        averageLTV: 70,
        medianLTV: 70,
        repeatCustomers: 0,
      },
    },
  ])('$name', async ({ orders, expected }) => {
    jest.spyOn(prisma.order, 'findMany').mockResolvedValue(orders as never);
    const result = await CustomerInsights.getOrderCommerceMetrics();
    expect(result.paidOrderCount).toBe(expected.paidOrderCount);
    expect(result.totalRevenue).toBeCloseTo(expected.totalRevenue, 5);
    expect(result.uniqueCustomers).toBe(expected.uniqueCustomers);
    expect(result.averageLTV).toBeCloseTo(expected.averageLTV, 5);
    expect(result.medianLTV).toBeCloseTo(expected.medianLTV, 5);
    expect(result.repeatCustomers).toBe(expected.repeatCustomers);
  });
});

describe('per-category low-stock thresholds and order timeline humanization', () => {
  const config = parseLowStockThresholds(
    JSON.stringify({
      defaultThreshold: 4,
      categories: { Originals: 0, 'Mixed Media': 2, postcards: 10 },
    }),
  );

  it.each([
    ['Originals', 0, 'Off (only at 0)'],
    ['originals', 0, 'Off (only at 0)'],
    ['Mixed Media', 2, '1–2 left'],
    ['mixed-media', 2, '1–2 left'],
    ['Postcards', 10, '1–10 left'],
    ['Prints', 4, '1–4 left'],
    ['', 4, '1–4 left'],
  ])('resolves category %p -> threshold %i (%s)', (category, expected, label) => {
    const resolved = resolveLowStockThreshold(category, config);
    expect(resolved).toBe(expected);
    expect(formatLowStockRangeLabel(resolved)).toBe(label);
  });

  it('falls back safely on empty or malformed JSON and clamps invalid values', () => {
    expect(parseLowStockThresholds(null)).toEqual({ defaultThreshold: 5, categories: {} });
    expect(parseLowStockThresholds('{bad')).toEqual({ defaultThreshold: 5, categories: {} });
    expect(normalizeCategoryThresholdKey('  Oil_Paintings  ')).toBe('oil-paintings');
  });

  it.each([
    {
      input: {
        message: 'Order placed and payment pending',
        details: 'Stripe checkout session created and awaiting payment confirmation',
      },
      expected: {
        message: 'Order received',
        details: 'We received your order details and began verifying payment.',
      },
    },
    {
      input: {
        message: 'Payment confirmed and order received',
        details: 'Payment confirmed by Stripe',
      },
      expected: {
        message: 'Order confirmed',
        details: 'Payment received — your artwork is reserved and queued for studio packaging.',
      },
    },
    {
      input: {
        message: 'Wrapped and dropped off at USPS',
        details: 'Hand-packed with a thank-you note.',
      },
      expected: {
        message: 'Wrapped and dropped off at USPS',
        details: 'Hand-packed with a thank-you note.',
      },
    },
  ])('humanizes order timeline entry "$input.message"', ({ input, expected }) => {
    expect(humanizeOrderTimelineEntry(input)).toEqual(expected);
  });
});

