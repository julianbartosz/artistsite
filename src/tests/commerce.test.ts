import {
  formatPrice,
  calculateTotal,
  calculateVariantPrice,
  productImageSrc,
  normalizeProduct,
  productHasPurchaseOptions,
  PRODUCT_IMAGE_FALLBACK,
  type Product,
} from '@/lib/commerce';
import { resolvePublicAssetUrl } from '@/lib/public-asset';
import { normalizeProductPayload } from '@/lib/admin-content';
import { pickVariantUrl } from '@/lib/image-variant-url';
import { createCartRecoveryToken, verifyCartRecoveryToken } from '@/lib/cart-recovery';
import {
  stableSearchParamsKey,
  activeFilterChips,
  removeFilterChip,
  activeFilterCount,
  displayFilterLabel,
} from '@/lib/search-params';
import { applyCommissionIntake } from '@/lib/commission-intake';
import {
  DEFAULT_CONTACT_PAGE,
  DEFAULT_HOME_PAGE,
  DEFAULT_SHOP_PAGE,
  QUIET_SHOP_CATALOG_LIMIT,
  SITE_CONTENT_DEFAULTS,
  applySiteLookbook,
  whiteTextContrastOnPrimary,
  contrastRatio,
  themeCssVariables,
} from '@/lib/site-content-shared';
import { InventoryService } from '@/lib/inventory';
import { isLiveStripePaymentIntent, OrderManager } from '@/lib/orders';

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

    it('uses thumb variant for uploaded images', () => {
      expect(productImageSrc({
        ...sampleProduct,
        images: { thumbnail: '/uploads/images/abc123.jpg', gallery: [] },
      })).toBe('/uploads/images/abc123-thumb.webp');
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
});

describe('image variant urls', () => {
  it('maps upload urls to webp variants', () => {
    expect(pickVariantUrl('/uploads/images/photo.jpg', 'md')).toBe('/uploads/images/photo-md.webp');
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
  it('evaluates contrast for white text on primary buttons', () => {
    expect(whiteTextContrastOnPrimary('#111827')).toBe('pass');
    expect(whiteTextContrastOnPrimary('#fde047')).toBe('fail');
    expect(contrastRatio('#ffffff', '#111827')).toBeGreaterThan(4.5);
  });

  it('includes card style variables in themeCssVariables', () => {
    const gallery = themeCssVariables({
      primaryColor: '#111827',
      accentColor: '#374151',
      fontPreset: 'system',
      cardStyle: 'gallery',
    });
    expect(gallery['--radius-card']).toBe('0px');
    const bold = themeCssVariables({
      primaryColor: '#111827',
      accentColor: '#374151',
      fontPreset: 'system',
      cardStyle: 'bold',
    });
    expect(bold['--shadow-card']).toContain('4px');
  });

  it.each([
    ['gallery-wall', 'gallery', false, false],
    ['compact-studio', 'studio', false, false],
    ['warm-print', 'studio', true, true],
    ['night-opening', 'bold', false, true],
  ] as const)('applySiteLookbook(%s) sets cardStyle=%s and shop chrome', (id, cardStyle, recentlyViewed, purchaseInfo) => {
    const next = applySiteLookbook(SITE_CONTENT_DEFAULTS, id);
    expect(next.identity.theme.cardStyle).toBe(cardStyle);
    expect(next.shop.showRecentlyViewed).toBe(recentlyViewed);
    expect(next.shop.showPurchaseInfo).toBe(purchaseInfo);
    expect(next.home.newsletter.showSection).toBe(id === 'warm-print' || id === 'night-opening');
  });

  it('keeps lean homepage defaults for new sites', () => {
    expect(DEFAULT_HOME_PAGE.newsletter.showSection).toBe(true);
    expect(DEFAULT_HOME_PAGE.blog.showSection).toBe(false);
    expect(DEFAULT_HOME_PAGE.about.showSection).toBe(false);
    expect(DEFAULT_HOME_PAGE.hero.showSecondaryCtas).toBe(false);
    expect(DEFAULT_HOME_PAGE.hero.portraitImage).toBe('/images/artist-portrait.jpg');
    expect(DEFAULT_SHOP_PAGE.showRecommendations).toBe(false);
    expect(QUIET_SHOP_CATALOG_LIMIT).toBe(12);
  });
});
