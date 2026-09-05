import 'server-only';
import { db } from '@/lib/db';
import { getProductById } from '@/lib/commerce-server';
import { productImageSrc, type Product } from '@/lib/commerce';

export type WishlistEntry = {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  productPrice: number;
  createdAt: string;
  product?: Product;
};

function snapshotFromProduct(product: Product) {
  return {
    productTitle: product.title,
    productImage: productImageSrc(product),
    productPrice: product.price,
  };
}

export async function listWishlistItems(userId: string): Promise<WishlistEntry[]> {
  const rows = await db.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(rows.map(async (row) => {
    const product = await getProductById(row.productId);
    return {
      id: row.id,
      productId: row.productId,
      productTitle: row.productTitle,
      productImage: row.productImage,
      productPrice: row.productPrice,
      createdAt: row.createdAt.toISOString(),
      product,
    };
  }));
}

export async function addWishlistItem(userId: string, productId: string): Promise<WishlistEntry> {
  const product = await getProductById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const snapshot = snapshotFromProduct(product);
  const row = await db.wishlistItem.upsert({
    where: {
      userId_productId: { userId, productId },
    },
    create: {
      userId,
      productId,
      ...snapshot,
    },
    update: snapshot,
  });

  return {
    id: row.id,
    productId: row.productId,
    productTitle: row.productTitle,
    productImage: row.productImage,
    productPrice: row.productPrice,
    createdAt: row.createdAt.toISOString(),
    product,
  };
}

export async function removeWishlistItem(userId: string, productId: string): Promise<boolean> {
  const result = await db.wishlistItem.deleteMany({
    where: { userId, productId },
  });
  return result.count > 0;
}

export async function mergeWishlistProductIds(userId: string, productIds: string[]): Promise<number> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  let merged = 0;

  for (const productId of uniqueIds) {
    try {
      await addWishlistItem(userId, productId);
      merged += 1;
    } catch {
      // Skip invalid or removed products without failing the whole merge.
    }
  }

  return merged;
}

export async function listWishlistProductIds(userId: string): Promise<string[]> {
  const rows = await db.wishlistItem.findMany({
    where: { userId },
    select: { productId: true },
  });
  return rows.map((row) => row.productId);
}
