import { pickVariantUrl, type ImageVariantSize } from '@/lib/image-variant-url';

export interface ProductVariant {
  id: string;
  name: string;
  description?: string;
  priceModifier: number; // Added price modifier
  available: boolean;
  stock?: number;
}

export const PRODUCT_IMAGE_FALLBACK = '/images/fallback-artwork.svg';
export const E2E_CHECKOUT_SESSION_PREFIX = 'e2e_';

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

type RawProductVariant = {
  id?: string;
  name?: string;
  description?: string;
  priceModifier?: number;
  price?: number;
  available?: boolean;
  stock?: number;
};

export type ProductInput = Omit<Product, 'variants' | 'customizations'> & {
  variants?: {
    sizes?: RawProductVariant[];
    framing?: RawProductVariant[];
    materials?: RawProductVariant[];
  };
  customizations?: Array<Partial<ProductCustomization> & { options?: Array<Partial<NonNullable<ProductCustomization['options']>[number]>> }>;
};

function optionIdFromLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'option';
}

/** Drop nameless / unusable purchase options; used by storefront reads and admin writes. */
export function normalizeVariant(variant: RawProductVariant): ProductVariant | null {
  if (!variant || typeof variant !== 'object') return null;

  const name = typeof variant.name === 'string' ? variant.name.trim() : '';
  if (!name) return null;

  const id = (typeof variant.id === 'string' ? variant.id.trim() : '') || optionIdFromLabel(name);
  if (!id) return null;

  const priceModifier = Number(variant.priceModifier ?? variant.price ?? 0);

  return {
    id,
    name,
    description: typeof variant.description === 'string' ? variant.description : undefined,
    priceModifier: Number.isFinite(priceModifier) ? priceModifier : 0,
    available: variant.available ?? true,
    // Variant JSON stock is not authoritative; ProductInventory drives availability.
  };
}

function normalizeVariantGroup(variants?: RawProductVariant[]): ProductVariant[] | undefined {
  if (!variants?.length) return undefined;
  const normalized = variants
    .map((variant) => normalizeVariant(variant))
    .filter((variant): variant is ProductVariant => variant !== null);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCustomizations(
  customizations?: ProductInput['customizations'],
): ProductCustomization[] | undefined {
  if (!customizations?.length) return undefined;

  const normalized = customizations.flatMap((customization) => {
    if (!customization || typeof customization !== 'object') return [];

    const name = typeof customization.name === 'string' ? customization.name.trim() : '';
    if (!name) return [];

    const id = (typeof customization.id === 'string' ? customization.id.trim() : '') || optionIdFromLabel(name);
    const type = customization.type || 'input';
    const options = type === 'select'
      ? (customization.options || [])
          .map((option) => {
            const optionName = typeof option?.name === 'string' ? option.name.trim() : '';
            if (!optionName) return null;
            const optionId = (typeof option?.id === 'string' ? option.id.trim() : '') || optionIdFromLabel(optionName);
            const price = Number(option?.price ?? 0);
            return {
              id: optionId,
              name: optionName,
              price: Number.isFinite(price) ? price : 0,
            };
          })
          .filter((option): option is NonNullable<typeof option> => option !== null)
      : undefined;

    if (type === 'select' && (!options || options.length === 0)) return [];

    return [{
      id,
      name,
      type,
      required: Boolean(customization.required),
      priceModifier: typeof customization.priceModifier === 'number' ? customization.priceModifier : undefined,
      options,
      placeholder: typeof customization.placeholder === 'string' ? customization.placeholder : undefined,
      maxLength: typeof customization.maxLength === 'number' ? customization.maxLength : undefined,
    } satisfies ProductCustomization];
  });

  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeEdition(value: unknown): Product['edition'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const total = Number((value as { total?: unknown }).total);
  if (!Number.isFinite(total) || total < 1) return undefined;
  const remainingRaw = Number((value as { remaining?: unknown }).remaining);
  const remaining = Number.isFinite(remainingRaw)
    ? Math.max(0, Math.min(total, remainingRaw))
    : total;
  return { total: Math.floor(total), remaining: Math.floor(remaining) };
}

/** Prefer live inventory remaining when the listing is tracked. */
export function applyEditionInventory(
  product: Product,
  availableStock?: number | null,
): Product {
  if (!product.edition) return product;
  if (availableStock === undefined || availableStock === null) return product;
  return {
    ...product,
    edition: {
      total: product.edition.total,
      remaining: Math.max(0, Math.min(product.edition.total, Math.floor(availableStock))),
    },
  };
}

export function normalizeProduct(product: ProductInput): Product {
  const gallery = product.images.gallery.map(image => image.trim()).filter(Boolean);
  const thumbnail = product.images.thumbnail.trim() || gallery[0] || PRODUCT_IMAGE_FALLBACK;
  const sizes = normalizeVariantGroup(product.variants?.sizes);
  const framing = normalizeVariantGroup(product.variants?.framing);
  const materials = normalizeVariantGroup(product.variants?.materials);
  const hasVariants = Boolean(sizes || framing || materials);
  const customizations = normalizeCustomizations(product.customizations);
  const edition = normalizeEdition(product.edition);

  return {
    ...product,
    slug: product.slug || product.id,
    images: {
      thumbnail,
      gallery: gallery.length > 0 ? gallery : [thumbnail],
    },
    variants: hasVariants ? { sizes, framing, materials } : undefined,
    customizations,
    edition,
  } as Product;
}

/** True when the product exposes size/frame/material or customization choices. */
export function productHasPurchaseOptions(product: Product): boolean {
  return Boolean(
    product.variants?.sizes?.length
    || product.variants?.framing?.length
    || product.variants?.materials?.length
    || product.customizations?.length,
  );
}

export function productImageSrc(
  product: Product,
  preferred?: string,
  size: ImageVariantSize = 'thumb',
): string {
  const base = preferred?.trim()
    || product.images.thumbnail?.trim()
    || product.images.gallery.find((image) => image.trim())
    || PRODUCT_IMAGE_FALLBACK;
  return pickVariantUrl(base, size);
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

type CartVariantChoice = NonNullable<CartItemVariant['size']>;

function pickDefaultVariantChoice(variants?: ProductVariant[]): CartVariantChoice | undefined {
  if (!variants?.length) return undefined;

  const preferred = variants.find((variant) => variant.available !== false && variant.priceModifier === 0)
    || variants.find((variant) => variant.available !== false)
    || variants[0];

  if (!preferred) return undefined;
  return {
    id: preferred.id,
    name: preferred.name,
    price: preferred.priceModifier,
  };
}

/** Defaults each option group to its included / first available choice for cart + UI selection. */
export function defaultCartItemVariant(product: Product, initial?: CartItemVariant): CartItemVariant {
  const size = initial?.size ?? pickDefaultVariantChoice(product.variants?.sizes);
  const framing = initial?.framing ?? pickDefaultVariantChoice(product.variants?.framing);
  const material = initial?.material ?? pickDefaultVariantChoice(product.variants?.materials);

  return {
    ...(size ? { size } : {}),
    ...(framing ? { framing } : {}),
    ...(material ? { material } : {}),
    ...(initial?.customizations?.length ? { customizations: initial.customizations } : {}),
  };
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

export function cartItemLineTotal(item: { totalPrice: number; quantity: number }): number {
  return item.totalPrice * item.quantity;
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
