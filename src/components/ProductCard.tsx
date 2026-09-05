'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/lib/commerce';
import { formatPrice, productImageSrc } from '@/lib/commerce';
import StockIndicator from '@/components/StockIndicator';
import { WishlistButton } from '@/components/WishlistButton';

interface ProductCardProps {
  product: Product;
}

export function ShopProductCard({ product }: ProductCardProps) {
  const isLimitedEdition = product.edition && product.edition.remaining < product.edition.total;
  const productHref = `/shop/${product.id}`;

  return (
    <article
      data-testid="product-card"
      className="group h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
    >
      <div className="relative aspect-square bg-gray-100 flex-shrink-0">
        <Link href={productHref} data-testid="product-card-link" className="absolute inset-0 block">
          <Image
            src={productImageSrc(product)}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transform-none"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Link>
        <div className="absolute top-3 right-3 z-20 pointer-events-auto opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <WishlistButton productId={product.id} size="sm" stopNavigation />
        </div>
        {product.featured && (
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="bg-primary text-white px-2 py-1 text-xs font-medium rounded">
              Featured
            </span>
          </div>
        )}
        {isLimitedEdition && (
          <div className="absolute bottom-3 left-3 pointer-events-none">
            <span className="bg-red-600 text-white px-2 py-1 text-xs font-medium rounded">
              Limited Edition
            </span>
          </div>
        )}
      </div>

      <Link href={productHref} className="flex flex-col flex-1 p-4 sm:p-6 min-h-0">
        <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors line-clamp-2">
          {product.title}
        </h3>
        <p className="text-sm text-gray-600">{product.medium}</p>
        <p className="text-sm text-gray-500 mb-2">{product.dimensions}</p>
        <p className="hidden md:block text-gray-700 text-sm mb-3 line-clamp-2 flex-1">{product.description}</p>

        <div className="flex justify-between items-center mt-auto pt-2">
          <span className="text-xl font-bold text-gray-900">
            {formatPrice(product.price, product.currency)}
          </span>
          <span className="text-sm text-gray-500 capitalize hidden sm:inline">
            {product.category.replace('-', ' ')}
          </span>
        </div>

        <div className="mt-2 pointer-events-none">
          <StockIndicator productId={product.id} />
        </div>

        {isLimitedEdition && (
          <p className="text-xs text-red-600 mt-2">
            Only {product.edition!.remaining} of {product.edition!.total} remaining
          </p>
        )}
      </Link>
    </article>
  );
}
