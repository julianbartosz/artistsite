export interface ProductVariant {
  id: string;
  name: string;
  description?: string;
  priceModifier: number; // Added price modifier
  available: boolean;
  stock?: number;
}

export const PRODUCT_IMAGE_FALLBACK = '/images/shop/placeholder-1.jpg';

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
  slug?: string;
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

type RawProductVariant = Omit<ProductVariant, 'priceModifier'> & {
  priceModifier?: number;
  price?: number;
};

export type ProductInput = Omit<Product, 'variants'> & {
  variants?: {
    sizes?: RawProductVariant[];
    framing?: RawProductVariant[];
    materials?: RawProductVariant[];
  };
};

export function normalizeVariant(variant: RawProductVariant): ProductVariant {
  return {
    ...variant,
    priceModifier: variant.priceModifier ?? variant.price ?? 0,
    available: variant.available ?? true,
  };
}

export function normalizeProduct(product: ProductInput): Product {
  const gallery = product.images.gallery.map(image => image.trim()).filter(Boolean);
  const thumbnail = product.images.thumbnail.trim() || gallery[0] || PRODUCT_IMAGE_FALLBACK;

  return {
    ...product,
    slug: product.slug || product.id,
    images: {
      thumbnail,
      gallery: gallery.length > 0 ? gallery : [thumbnail],
    },
    variants: product.variants
      ? {
          sizes: product.variants.sizes?.map(normalizeVariant),
          framing: product.variants.framing?.map(normalizeVariant),
          materials: product.variants.materials?.map(normalizeVariant),
        }
      : undefined,
  } as Product;
}

export function productImageSrc(product: Product, preferred?: string): string {
  return preferred?.trim() || product.images.thumbnail?.trim() || product.images.gallery.find(image => image.trim()) || PRODUCT_IMAGE_FALLBACK;
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

export function formatCartItemVariant(variant?: CartItemVariant): string | null {
  if (!variant) return null;

  const parts = [
    variant.size?.name,
    variant.framing?.name,
    variant.material?.name,
    ...(variant.customizations?.map(customization => `${customization.name}: ${customization.value}`) || []),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(price);
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
