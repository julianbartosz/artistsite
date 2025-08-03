import products from '@/content/shop/products.json';

export interface ProductVariant {
  id: string;
  name: string;
  description?: string;
  priceModifier: number; // Added price modifier
  available: boolean;
  stock?: number;
}

export interface ProductCustomization {
  id: string;
  name: string;
  type: 'select' | 'input' | 'checkbox' | 'textarea';
  required: boolean;
  priceModifier?: number; // Added price modifier
  options?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  placeholder?: string;
  maxLength?: number;
}

export interface ProductBundle {
  id: string;
  items: Array<{
    productId: string;
    quantity: number;
    discount?: number;
  }>;
  totalDiscount: number;
  description: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  medium: string;
  dimensions: string;
  year: number;
  availability: 'available' | 'sold' | 'reserved' | 'commissioned';
  featured: boolean;
  images: {
    thumbnail: string;
    gallery: string[];
  };
  tags: string[];
  shipping: {
    domestic: number;
    international: number;
  };
  specifications: {
    framed: boolean;
    signed: boolean;
    certificate: boolean;
  };
  edition?: {
    total: number;
    remaining: number;
  };
  // New advanced features
  variants?: {
    sizes?: ProductVariant[];
    framing?: ProductVariant[];
    materials?: ProductVariant[];
  };
  customizations?: ProductCustomization[];
  relatedProducts?: string[];
  bundle?: ProductBundle;
  commissionInfo?: {
    available: boolean;
    estimatedDays: number;
    priceRange: {
      min: number;
      max: number;
    };
    requiresConsultation: boolean;
  };
}

export interface CartItemVariant {
  size?: {
    id: string;
    name: string;
    price: number;
  };
  framing?: {
    id: string;
    name: string;
    price: number;
  };
  material?: {
    id: string;
    name: string;
    price: number;
  };
  customizations?: Array<{
    id: string;
    name: string;
    value: string;
    price: number;
  }>;
}

export function getAllProducts(): Product[] {
  return products as Product[];
}

export function getAvailableProducts(): Product[] {
  return products.filter(product => 
    product.availability === 'available' || product.availability === 'commissioned'
  ) as Product[];
}

export function getFeaturedProducts(): Product[] {
  return products.filter(product => 
    product.featured && (product.availability === 'available' || product.availability === 'commissioned')
  ) as Product[];
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter(product => product.category === category) as Product[];
}

export function getProductById(id: string): Product | undefined {
  try {
    const product = products.find(product => product.id === id) as Product | undefined;
    
    // Validate product data integrity
    if (product) {
      if (typeof product.price !== 'number' || product.price < 0) {
        console.error('Invalid product price detected:', { 
          id, 
          price: product.price, 
          type: typeof product.price 
        });
        return undefined;
      }
      
      if (!product.currency) {
        console.warn('Product missing currency, defaulting to USD:', { id });
        product.currency = 'USD';
      }
    }
    
    return product;
  } catch (error) {
    console.error('Error retrieving product:', error, { id });
    return undefined;
  }
}

export function getProductsByTag(tag: string): Product[] {
  return products.filter(product => product.tags.includes(tag)) as Product[];
}

export function getRelatedProducts(productId: string, limit: number = 4): Product[] {
  const product = getProductById(productId);
  if (!product) return [];

  // First try explicit related products
  if (product.relatedProducts) {
    const related = product.relatedProducts
      .map(id => getProductById(id))
      .filter(Boolean) as Product[];
    if (related.length >= limit) return related.slice(0, limit);
  }

  // Fall back to products with similar tags or category
  const similar = products.filter(p => 
    p.id !== productId && 
    p.availability === 'available' &&
    (p.category === product.category || 
     product.tags.some(tag => p.tags.includes(tag)))
  ) as Product[];

  return similar.slice(0, limit);
}

export function calculateVariantPrice(basePrice: number, variants?: CartItemVariant): number {
  let totalPrice = basePrice;
  
  if (variants?.size) totalPrice += variants.size.price;
  if (variants?.framing) totalPrice += variants.framing.price;
  if (variants?.material) totalPrice += variants.material.price;
  if (variants?.customizations) {
    totalPrice += variants.customizations.reduce((sum, custom) => sum + custom.price, 0);
  }
  
  return totalPrice;
}

export function formatPrice(price: number | undefined | null, currency: string = 'USD'): string {
  // Enhanced debugging for price formatting issues
  if (price === undefined || price === null) {
    console.warn('formatPrice called with undefined/null price:', { price, currency });
    return 'Price not available';
  }
  
  if (isNaN(price) || price < 0) {
    console.warn('formatPrice called with invalid price:', { price, currency, type: typeof price });
    return 'Price not available';
  }
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  } catch (error) {
    console.error('Error formatting price:', error, { price, currency });
    return 'Price not available';
  }
}

export function getCategories(): string[] {
  const categories = products.map(product => product.category);
  return [...new Set(categories)];
}

export function calculateTotal(price: number, shipping: number): number {
  return price + shipping;
}

export function validateCustomizations(
  customizations: ProductCustomization[],
  values: Record<string, string>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  customizations.forEach(custom => {
    const value = values[custom.id];
    
    if (custom.required && (!value || value.trim() === '')) {
      errors.push(`${custom.name} is required`);
      return;
    }

    if (value && custom.maxLength && value.length > custom.maxLength) {
      errors.push(`${custom.name} must be ${custom.maxLength} characters or less`);
    }

    if (custom.type === 'select' && value && custom.options) {
      const validOption = custom.options.some(opt => opt.id === value);
      if (!validOption) {
        errors.push(`Invalid selection for ${custom.name}`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}
