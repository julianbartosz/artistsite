import {
  formatPrice,
  calculateTotal,
  calculateVariantPrice,
  productImageSrc,
  normalizeProduct,
  PRODUCT_IMAGE_FALLBACK,
  type Product,
} from '@/lib/commerce';

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
});

describe('image variant urls', () => {
  it('maps upload urls to webp variants', () => {
    const { pickVariantUrl } = require('@/lib/image-variant-url');
    expect(pickVariantUrl('/uploads/images/photo.jpg', 'md')).toBe('/uploads/images/photo-md.webp');
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
    const { createCartRecoveryToken, verifyCartRecoveryToken } = require('@/lib/cart-recovery');
    const token = createCartRecoveryToken([], 'buyer@example.com');
    const payload = verifyCartRecoveryToken(token);
    expect(payload?.email).toBe('buyer@example.com');
    expect(payload?.items).toEqual([]);
  });
});

describe('search params helpers', () => {
  it('builds stable keys regardless of param order', () => {
    const { stableSearchParamsKey } = require('@/lib/search-params');
    expect(stableSearchParamsKey(new URLSearchParams('sort=price&page=2'))).toBe('page=2&sort=price');
    expect(stableSearchParamsKey(new URLSearchParams('page=2&sort=price'))).toBe('page=2&sort=price');
  });

  it('lists and removes active filter chips', () => {
    const { activeFilterChips, removeFilterChip, activeFilterCount } = require('@/lib/search-params');
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
    const { applyCommissionIntake } = require('@/lib/commission-intake');
    const { DEFAULT_CONTACT_PAGE } = require('@/lib/site-content-shared');
    const next = applyCommissionIntake(DEFAULT_CONTACT_PAGE, ['commission', 'purchase']);
    const visible = next.form.inquiryTypes.filter((item: { visible: boolean }) => item.visible);
    expect(visible.map((item: { key: string }) => item.key)).toEqual(['purchase', 'commission']);
    expect(next.sidebar.commissionHtml).toContain('commission projects');
  });
});

describe('inventory purchasability', () => {
  it('treats untracked products as purchasable when availability is available', () => {
    const { InventoryService } = require('@/lib/inventory');
    expect(InventoryService.isPurchasableFromStatus('available', null)).toBe(true);
  });

  it('blocks sold availability regardless of inventory', () => {
    const { InventoryService } = require('@/lib/inventory');
    expect(InventoryService.isPurchasableFromStatus('sold', null)).toBe(false);
  });

  it('requires stock when inventory tracking exists', () => {
    const { InventoryService } = require('@/lib/inventory');
    expect(InventoryService.isPurchasableFromStatus('available', {
      productId: 'p1',
      currentStock: 0,
      availableStock: 0,
      reservedStock: 0,
      stockStatus: 'out_of_stock',
      lowStockThreshold: 1,
      allowBackorders: false,
    })).toBe(false);
  });
});

describe('site theme utilities', () => {
  it('evaluates contrast for white text on primary buttons', () => {
    const { whiteTextContrastOnPrimary, contrastRatio } = require('@/lib/site-content-shared');
    expect(whiteTextContrastOnPrimary('#111827')).toBe('pass');
    expect(whiteTextContrastOnPrimary('#fde047')).toBe('fail');
    expect(contrastRatio('#ffffff', '#111827')).toBeGreaterThan(4.5);
  });

  it('includes card style variables in themeCssVariables', () => {
    const { themeCssVariables } = require('@/lib/site-content-shared');
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
});
