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