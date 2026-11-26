import { isVideoUrl, pickVariantUrl, type ImageVariantSize } from '@/lib/image-variant-url';

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
    /** Defaults to true when omitted (legacy listings). */
    domesticEnabled?: boolean;
    /** Defaults to true when omitted (legacy listings). */
    internationalEnabled?: boolean;
    /** Optional parcel metadata used when quoting/buying EasyPost labels. */
    parcel?: {
      weightOz?: number;
      lengthIn?: number;
      widthIn?: number;
      heightIn?: number;
    };
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
  const rawThumb = product.images.thumbnail.trim();
  const firstStill = (!rawThumb || isVideoUrl(rawThumb))
    ? gallery.find((image) => !isVideoUrl(image))
    : rawThumb;
  const thumbnail = firstStill || rawThumb || gallery[0] || PRODUCT_IMAGE_FALLBACK;
  const sizes = normalizeVariantGroup(product.variants?.sizes);
  const framing = normalizeVariantGroup(product.variants?.framing);
  const materials = normalizeVariantGroup(product.variants?.materials);
  const hasVariants = Boolean(sizes || framing || materials);
  const customizations = normalizeCustomizations(product.customizations);
  const edition = normalizeEdition(product.edition);
  const shipping = normalizeShipping(product.shipping);

  return {
    ...product,
    slug: product.slug || product.id,
    images: {
      thumbnail,
      gallery: gallery.length > 0 ? gallery : [thumbnail],
    },
    shipping,
    variants: hasVariants ? { sizes, framing, materials } : undefined,
    customizations,
    edition,
  } as Product;
}

export const SUPPORTED_CHECKOUT_COUNTRIES = ['US', 'CA', 'GB', 'AU'] as const;
export type SupportedCheckoutCountry = (typeof SUPPORTED_CHECKOUT_COUNTRIES)[number];

export const CHECKOUT_COUNTRY_LABELS: Record<SupportedCheckoutCountry, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  AU: 'Australia',
};

function normalizeShippingParcel(
  parcel: NonNullable<Product['shipping']['parcel']> | undefined | null,
): Product['shipping']['parcel'] | undefined {
  if (!parcel || typeof parcel !== 'object') return undefined;
  const positive = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined;
  };
  const weightOz = positive(parcel.weightOz);
  const lengthIn = positive(parcel.lengthIn);
  const widthIn = positive(parcel.widthIn);
  const heightIn = positive(parcel.heightIn);
  if (!weightOz && !lengthIn && !widthIn && !heightIn) return undefined;
  return {
    ...(weightOz ? { weightOz } : {}),
    ...(lengthIn ? { lengthIn } : {}),
    ...(widthIn ? { widthIn } : {}),
    ...(heightIn ? { heightIn } : {}),
  };
}

export function normalizeShipping(value: Product['shipping'] | undefined | null): Product['shipping'] {
  const domesticRaw = Number(value?.domestic ?? 0);
  const internationalRaw = Number(value?.international ?? 0);
  const parcel = normalizeShippingParcel(value?.parcel);
  return {
    domestic: Number.isFinite(domesticRaw) && domesticRaw >= 0 ? domesticRaw : 0,
    international: Number.isFinite(internationalRaw) && internationalRaw >= 0 ? internationalRaw : 0,
    domesticEnabled: value?.domesticEnabled !== false,
    internationalEnabled: value?.internationalEnabled !== false,
    ...(parcel ? { parcel } : {}),
  };
}

export function productShipsDomestically(product: Pick<Product, 'shipping'>): boolean {
  return product.shipping?.domesticEnabled !== false;
}

export function productShipsInternationally(product: Pick<Product, 'shipping'>): boolean {
  return product.shipping?.internationalEnabled !== false;
}

export function productAllowsCountry(product: Pick<Product, 'shipping'>, country: string): boolean {
  const domestic = productShipsDomestically(product);
  const international = productShipsInternationally(product);
  if (!domestic && !international) return true; // Local pickup / no shipping required
  return country === 'US' ? domestic : international;
}

export function calculateItemShipping(product: Pick<Product, 'shipping'>, country: string): number {
  const domestic = productShipsDomestically(product);
  const international = productShipsInternationally(product);
  if (!domestic && !international) return 0;
  return country === 'US' ? (product.shipping?.domestic ?? 0) : (product.shipping?.international ?? 0);
}

export function allowedCheckoutCountriesForItems(
  items: Array<{ product: Pick<Product, 'shipping'> }>,
): { countries: SupportedCheckoutCountry[]; isPickupOnly: boolean; hasConflict: boolean } {
  if (items.length === 0) {
    return { countries: [...SUPPORTED_CHECKOUT_COUNTRIES], isPickupOnly: false, hasConflict: false };
  }
  const shippable = items.filter(
    (item) => productShipsDomestically(item.product) || productShipsInternationally(item.product),
  );
  if (shippable.length === 0) {
    return { countries: [...SUPPORTED_CHECKOUT_COUNTRIES], isPickupOnly: true, hasConflict: false };
  }
  const allowUs = shippable.every((item) => productShipsDomestically(item.product));
  const allowIntl = shippable.every((item) => productShipsInternationally(item.product));
  const countries: SupportedCheckoutCountry[] = [
    ...(allowUs ? (['US'] as const) : []),
    ...(allowIntl ? (['CA', 'GB', 'AU'] as const) : []),
  ];
  return { countries, isPickupOnly: false, hasConflict: countries.length === 0 };
}

export function describeProductShipping(
  product: Pick<Product, 'shipping' | 'currency'>,
): {
  domesticLabel: string | null;
  internationalLabel: string | null;
  isPickupOnly: boolean;
  summary: string;
} {
  const domestic = productShipsDomestically(product);
  const international = productShipsInternationally(product);
  const currency = product.currency || 'USD';
  const formatLane = (amount: number) => (amount <= 0 ? 'Free' : formatPrice(amount, currency));

  if (!domestic && !international) {
    return {
      domesticLabel: null,
      internationalLabel: null,
      isPickupOnly: true,
      summary: 'Local pickup / arranged with studio',
    };
  }

  const domesticLabel = domestic ? formatLane(product.shipping.domestic) : null;
  const internationalLabel = international ? formatLane(product.shipping.international) : null;

  const parts: string[] = [];
  if (domesticLabel) parts.push(`US ${domesticLabel}`);
  if (internationalLabel) parts.push(`International ${internationalLabel}`);
  else if (domestic) parts.push('US shipping only');

  return {
    domesticLabel,
    internationalLabel,
    isPickupOnly: false,
    summary: parts.join(' • '),
  };
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

export function productRawImageSrc(
  product: Pick<Product, 'images'>,
  preferred?: string,
): string {
  const explicit = preferred?.trim();
  if (explicit) return explicit;

  const candidates = [
    product.images.thumbnail?.trim(),
    ...product.images.gallery.map((image) => image.trim()),
  ].filter((url): url is string => Boolean(url));

  const firstStill = candidates.find((url) => !isVideoUrl(url));
  return firstStill || candidates[0] || PRODUCT_IMAGE_FALLBACK;
}

/** Deduplicate and trim an ordered list of image/video URLs, falling back to the shared placeholder when empty. */
export function collectImageGallery(
  ...sources: Array<string | readonly string[] | null | undefined>
): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    const entries = typeof source === 'string' ? [source] : source;
    for (const raw of entries) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      list.push(trimmed);
    }
  }
  return list.length > 0 ? list : [PRODUCT_IMAGE_FALLBACK];
}

/**
 * Ordered, deduplicated gallery media for a shop product.
 * Respects `gallery`'s explicit order when `thumbnail` is already present (e.g. a video-first gallery
 * whose `thumbnail` points to the first still photo for OG/Stripe/cart previews), while still
 * prepending `thumbnail` for legacy records where it was stored separately from `gallery`.
 */
export function productGalleryImages(product: Pick<Product, 'images'>): string[] {
  const thumb = product.images.thumbnail?.trim() || '';
  const cleanedGallery = product.images.gallery
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);

  if (!thumb || thumb === PRODUCT_IMAGE_FALLBACK || cleanedGallery.includes(thumb)) {
    return collectImageGallery(cleanedGallery, thumb);
  }
  return collectImageGallery(thumb, cleanedGallery);
}

/**
 * Ordered, deduplicated gallery media for a portfolio artwork.
 * Preserves `gallery`'s explicit order when `main`/`thumbnail` is already present (e.g. a video-first
 * piece whose `main`/`thumbnail` points to the first still photo for OG/schema previews), while avoiding
 * duplicate slides for legacy thumbnail + main pairs.
 */
export function artworkGalleryImages(images: {
  main?: string | null;
  thumbnail?: string | null;
  gallery?: readonly string[] | null;
}): string[] {
  const primary = images.main?.trim() || images.thumbnail?.trim() || '';
  const cleanedGallery = (images.gallery ?? [])
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);

  if (!primary || primary === PRODUCT_IMAGE_FALLBACK || cleanedGallery.includes(primary)) {
    return collectImageGallery(cleanedGallery, primary);
  }
  return collectImageGallery(primary, cleanedGallery);
}

export function productImageSrc(
  product: Pick<Product, 'images'>,
  preferred?: string,
  size: ImageVariantSize = 'thumb',
): string {
  return pickVariantUrl(productRawImageSrc(product, preferred), size);
}

/** Human-readable copy for numbered limited editions across product cards and detail pages. */
export function formatEditionStatus(edition: Product['edition'] | null | undefined): string | null {
  if (!edition || !Number.isFinite(edition.total) || edition.total < 1) return null;
  const total = Math.floor(edition.total);
  const remaining = Math.max(0, Math.min(total, Math.floor(edition.remaining)));
  if (remaining === 0) return `Sold out · Edition of ${total}`;
  if (remaining === total) return `Edition of ${total}`;
  return `${remaining} of ${total} remaining`;
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

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
export const MAX_LOW_STOCK_THRESHOLD = 9999;

export interface LowStockThresholdConfig {
  /** Fallback threshold (0 = never flag low stock, only out of stock at 0). */
  defaultThreshold: number;
  /** Per-category thresholds keyed by normalized category key. */
  categories: Record<string, number>;
}

/** Canonical lookup key for a product category name/slug (e.g. "Mixed Media" -> "mixed-media"). */
export function normalizeCategoryThresholdKey(category: string | null | undefined): string {
  if (!category) return '';
  return category
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function clampThreshold(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(MAX_LOW_STOCK_THRESHOLD, Math.floor(numeric)));
}

export function sanitizeLowStockThresholds(
  input: Partial<LowStockThresholdConfig> | null | undefined,
): LowStockThresholdConfig {
  const defaultThreshold = clampThreshold(input?.defaultThreshold, DEFAULT_LOW_STOCK_THRESHOLD);
  const categories: Record<string, number> = {};
  if (input?.categories && typeof input.categories === 'object' && !Array.isArray(input.categories)) {
    for (const [rawKey, rawValue] of Object.entries(input.categories)) {
      const key = normalizeCategoryThresholdKey(rawKey);
      if (!key) continue;
      if (rawValue === null || rawValue === undefined || (rawValue as unknown) === '') continue;
      categories[key] = clampThreshold(rawValue, defaultThreshold);
    }
  }
  return { defaultThreshold, categories };
}

export function parseLowStockThresholds(raw: string | null | undefined): LowStockThresholdConfig {
  if (!raw || !raw.trim()) {
    return { defaultThreshold: DEFAULT_LOW_STOCK_THRESHOLD, categories: {} };
  }
  try {
    return sanitizeLowStockThresholds(JSON.parse(raw) as Partial<LowStockThresholdConfig>);
  } catch {
    return { defaultThreshold: DEFAULT_LOW_STOCK_THRESHOLD, categories: {} };
  }
}

export function resolveLowStockThreshold(
  category: string | null | undefined,
  config: LowStockThresholdConfig,
): number {
  const key = normalizeCategoryThresholdKey(category);
  if (key && Object.prototype.hasOwnProperty.call(config.categories, key)) {
    return config.categories[key];
  }
  return config.defaultThreshold;
}

export function formatLowStockRangeLabel(threshold: number): string {
  if (threshold <= 0) return 'Off (only at 0)';
  if (threshold === 1) return 'At 1 left';
  return `1–${threshold} left`;
}
