// Domain types for Shop
export interface ProductVariant {
  id: string;
  name: string;
  description?: string;
  priceModifier: number;
  available: boolean;
  stock?: number;
}
export interface ProductCustomization {
  id: string;
  name: string;
  type: 'select' | 'input' | 'checkbox' | 'textarea';
  required: boolean;
  priceModifier?: number;
  options?: Array<{ id: string; name: string; price: number }>;
  placeholder?: string;
  maxLength?: number;
}
export interface ProductBundleItem { productId: string; quantity: number; discount?: number }
export interface ProductBundle {
  id: string;
  items: ProductBundleItem[];
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
  images: { thumbnail: string; gallery: string[] };
  tags: string[];
  shipping: { domestic: number; international: number };
  specifications: { framed: boolean; signed: boolean; certificate: boolean };
  edition?: { total: number; remaining: number };
  variants?: { sizes?: ProductVariant[]; framing?: ProductVariant[]; materials?: ProductVariant[] };
  customizations?: ProductCustomization[];
  relatedProducts?: string[];
  bundle?: ProductBundle;
  commissionInfo?: {
    available: boolean;
    estimatedDays: number;
    priceRange: { min: number; max: number };
    requiresConsultation: boolean;
  };
}
export interface CartItemVariant {
  size?: { id: string; name: string; priceModifier: number };
  framing?: { id: string; name: string; priceModifier: number };
  material?: { id: string; name: string; priceModifier: number };
  customizations?: Array<{ id: string; name: string; value: string; priceModifier: number }>;
}
