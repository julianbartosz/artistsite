import {
  getAllProducts,
  getAvailableProducts,
  getFeaturedProducts,
  getProductById,
  getProductsByCategory,
  formatPrice,
  getCategories,
  calculateTotal,
  type Product,
} from '@/lib/commerce';

describe('Commerce Library', () => {
  describe('getAllProducts', () => {
    it('should return all products', () => {
      const products = getAllProducts();
      expect(products.length).toBeGreaterThan(0);
      expect(products[0]).toHaveProperty('id');
      expect(products[0]).toHaveProperty('title');
      expect(products[0]).toHaveProperty('price');
    });
  });

  describe('getAvailableProducts', () => {
    it('should return only available products', () => {
      const availableProducts = getAvailableProducts();
      expect(availableProducts.length).toBeGreaterThan(0);
      expect(availableProducts.every(p => p.availability === 'available' || p.availability === 'commissioned')).toBe(true);
    });
  });

  describe('getFeaturedProducts', () => {
    it('should return only featured and available products', () => {
      const featuredProducts = getFeaturedProducts();
      expect(featuredProducts.length).toBeGreaterThan(0);
      expect(featuredProducts.every(p => p.featured && (p.availability === 'available' || p.availability === 'commissioned'))).toBe(true);
    });
  });

  describe('getProductById', () => {
    it('should return product by id', () => {
      const allProducts = getAllProducts();
      const firstProduct = allProducts[0];
      
      if (firstProduct) {
        const product = getProductById(firstProduct.id);
        expect(product).toBeDefined();
        expect(product?.title).toBe(firstProduct.title);
      }
    });

    it('should return undefined for non-existent product', () => {
      const product = getProductById('non-existent');
      expect(product).toBeUndefined();
    });
  });

  describe('getProductsByCategory', () => {
    it('should return products by category', () => {
      const allProducts = getAllProducts();
      const firstCategory = allProducts[0]?.category;
      
      if (firstCategory) {
        const categoryProducts = getProductsByCategory(firstCategory);
        expect(categoryProducts.length).toBeGreaterThan(0);
        expect(categoryProducts.every(p => p.category === firstCategory)).toBe(true);
      }
    });

    it('should return empty array for non-existent category', () => {
      const products = getProductsByCategory('non-existent-category');
      expect(products).toHaveLength(0);
    });
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

  describe('getCategories', () => {
    it('should return unique categories', () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThan(0);
      // Should be unique
      expect(new Set(categories).size).toBe(categories.length);
    });
  });

  describe('calculateTotal', () => {
    it('should calculate total with shipping', () => {
      expect(calculateTotal(500, 25)).toBe(525);
      expect(calculateTotal(200, 15)).toBe(215);
    });
  });
});