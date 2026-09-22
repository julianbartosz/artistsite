import {
  formatPrice,
  calculateTotal,
  calculateVariantPrice,
  productImageSrc,
  normalizeProduct,
  PRODUCT_IMAGE_FALLBACK,
  type Product,
} from '@/lib/commerce';
import { pickVariantUrl } from '@/lib/image-variant-url';
import { createCartRecoveryToken, verifyCartRecoveryToken } from '@/lib/cart-recovery';
import {
  stableSearchParamsKey,
  activeFilterChips,
  removeFilterChip,
  activeFilterCount,
} from '@/lib/search-params';
import { applyCommissionIntake } from '@/lib/commission-intake';
import {
  DEFAULT_CONTACT_PAGE,
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
});

describe('image variant urls', () => {
  it('maps upload urls to webp variants', () => {
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
});
