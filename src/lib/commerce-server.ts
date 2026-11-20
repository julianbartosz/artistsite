import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { applyEditionInventory, normalizeProduct, Product, ProductInput } from './commerce';

type ProductRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  medium: string;
  dimensions: string;
  year: number;
  availability: string;
  featured: boolean;
  images: unknown;
  tags: unknown;
  shipping: unknown;
  specifications: unknown;
  variants?: unknown;
  customizations?: unknown;
  relatedProducts?: unknown;
  bundle?: unknown;
  commissionInfo?: unknown;
  edition?: unknown;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : fallback;
}

function toProduct(record: ProductRecord): Product {
  const input: ProductInput = {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    price: record.price,
    currency: record.currency,
    category: record.category,
    medium: record.medium,
    dimensions: record.dimensions,
    year: record.year,
    availability: record.availability as Product['availability'],
    featured: record.featured,
    images: asObject(record.images, { thumbnail: '', gallery: [] }) as Product['images'],
    tags: asArray<string>(record.tags),
    shipping: asObject(record.shipping, { domestic: 0, international: 0 }) as Product['shipping'],
    specifications: asObject(record.specifications, { framed: false, signed: false, certificate: false }) as Product['specifications'],
    variants: record.variants as ProductInput['variants'],
    customizations: asArray(record.customizations),
    relatedProducts: asArray(record.relatedProducts),
    bundle: record.bundle as Product['bundle'],
    commissionInfo: record.commissionInfo as Product['commissionInfo'],
    edition: record.edition as Product['edition'],
  };

  return normalizeProduct(input);
}

async function withLiveEditionStock(products: Product[]): Promise<Product[]> {
  const tracked = products.filter((product) => product.edition);
  if (tracked.length === 0) return products;
  const rows = await db.productInventory.findMany({
    where: { productId: { in: tracked.map((product) => product.id) } },
    select: { productId: true, availableStock: true },
  });
  const stockByProduct = new Map(rows.map((row) => [row.productId, row.availableStock]));
  return products.map((product) => {
    if (!product.edition) return product;
    return applyEditionInventory(product, stockByProduct.get(product.id));
  });
}

const getCachedProducts = unstable_cache(
  async () => {
    const records = await db.product.findMany({
      orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
    });
    const products = await withLiveEditionStock(
      records.map((record) => toProduct(record as ProductRecord)),
    );
    return products.sort(
      (left, right) => availabilityRank(left.availability) - availabilityRank(right.availability),
    );
  },
  ['products'],
  { tags: ['products'], revalidate: 300 }
);

function availabilityRank(availability: Product['availability']): number {
  if (availability === 'available') return 0;
  if (availability === 'commissioned') return 1;
  if (availability === 'reserved') return 2;
  return 3;
}

export async function getAllProducts(): Promise<Product[]> {
  return getCachedProducts();
}

export async function getAvailableProducts(): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter(product =>
    product.availability === 'available' || product.availability === 'commissioned'
  );
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter(product =>
    product.featured && (product.availability === 'available' || product.availability === 'commissioned')
  );
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter(product => product.category === category);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const product = await db.product.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
    },
  });
  if (!product) return undefined;
  const normalized = toProduct(product as ProductRecord);
  if (!normalized.edition) return normalized;
  const [withStock] = await withLiveEditionStock([normalized]);
  return withStock;
}

/** Match a portfolio piece to a shop listing by shared title or slug (no separate join table). */
export async function findShopProductForArtwork(artwork: {
  title: string;
  slug: string;
}): Promise<Product | undefined> {
  const products = await getAllProducts();
  const titleNorm = artwork.title.trim().toLowerCase();
  const slugNorm = artwork.slug.trim().toLowerCase();

  return products.find((product) => {
    const productTitle = product.title.trim().toLowerCase();
    const productSlug = (product.slug || product.id).trim().toLowerCase();
    return productTitle === titleNorm || productSlug === slugNorm || product.id === artwork.slug;
  });
}

export async function getProductsByTag(tag: string): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter(product => product.tags.includes(tag));
}

export async function getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
  const product = await getProductById(productId);
  if (!product) return [];

  if (product.relatedProducts?.length) {
    const related = (await Promise.all(product.relatedProducts.map(id => getProductById(id))))
      .filter(Boolean) as Product[];
    if (related.length >= limit) return related.slice(0, limit);
  }

  const products = await getAllProducts();
  return products.filter(candidate =>
    candidate.id !== product.id &&
    candidate.availability === 'available' &&
    (candidate.category === product.category || product.tags.some(tag => candidate.tags.includes(tag)))
  ).slice(0, limit);
}

export async function getCategories(): Promise<string[]> {
  const products = await getAllProducts();
  return [...new Set(products.map(product => product.category))];
}