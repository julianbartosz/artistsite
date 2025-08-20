// Re-export legacy component during migration to feature-based @ui structure
'use client';
import { IconSpinner } from '@ui/icons/actions';
import type { Product } from '@domain/shop';
import { useAddToCart } from './hooks/useAddToCart';
import ProductVariantSelector from '@ui/components/commerce/ProductVariantSelector';
import CustomCommissionRequest from '@ui/components/commerce/CustomCommissionRequest';

interface AddToCartButtonProps {
  product: Product;
  className?: string;
  showVariants?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function AddToCartButton({
  product,
  className = '',
  showVariants = true,
  size = 'md',
}: AddToCartButtonProps) {
  const {
    selectedVariant,
    currentPrice,
    isAdding,
    showCommissionForm,
    isSubmittingCommission,
    isAvailable,
    isCommissionOnly,
    isSoldOut,
    isInStock,
    itemInCart,
    setShowCommissionForm,
    handleVariantChange,
    handlePriceChange,
    handleAddToCart,
    handleCommissionSubmit,
    formatPrice,
  } = useAddToCart(product);

  const buttonSizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  } as const;

  if (showCommissionForm) {
    return (
      <CustomCommissionRequest
        product={product}
        onSubmit={handleCommissionSubmit}
        onCancel={() => setShowCommissionForm(false)}
        isLoading={isSubmittingCommission}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Product Variants */}
      {showVariants && (product.variants || product.customizations) && (
        <ProductVariantSelector
          product={product}
          initialVariant={selectedVariant}
          onVariantChange={handleVariantChange}
          onPriceChange={handlePriceChange}
        />
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Regular Purchase Button */}
        {isAvailable && (
          <button
            onClick={handleAddToCart}
            disabled={isAdding || !isInStock()}
            className={`w-full font-medium rounded-lg transition-all duration-200 ${buttonSizes[size]} ${
              isAdding || !isInStock()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
            } ${className}`}
          >
            {isAdding ? (
              <span className="flex items-center justify-center">
                <IconSpinner className="animate-spin -ml-1 mr-3 h-5 w-5" />
                Adding to Cart...
              </span>
            ) : !isInStock() ? (
              'Out of Stock'
            ) : itemInCart ? (
              `Update Cart (${formatPrice(currentPrice)})`
            ) : (
              `Add to Cart • ${formatPrice(currentPrice)}`
            )}
          </button>
        )}

        {/* Commission Request Button */}
        {(isCommissionOnly || product.commissionInfo?.available) && (
          <button
            onClick={() => setShowCommissionForm(true)}
            className={`w-full font-medium rounded-lg transition-all duration-200 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 ${buttonSizes[size]} ${className}`}
          >
            {isCommissionOnly ? 'Request Commission' : 'Commission Similar Piece'}
          </button>
        )}

        {/* Sold Out Message */}
        {isSoldOut && (
          <div className="text-center">
            <div
              className={`w-full font-medium rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed ${buttonSizes[size]}`}
            >
              {product.availability === 'sold' ? 'Sold' : 'Reserved'}
            </div>
            {product.commissionInfo?.available && (
              <button
                onClick={() => setShowCommissionForm(true)}
                className="mt-2 text-indigo-600 hover:text-indigo-700 text-sm underline"
              >
                Commission a similar piece
              </button>
            )}
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="text-sm text-gray-600 space-y-2">
        {/* Edition Info */}
        {product.edition && (
          <div className="flex justify-between items-center">
            <span>Limited Edition:</span>
            <span className="font-medium">
              {product.edition.remaining} of {product.edition.total} remaining
            </span>
          </div>
        )}

        {/* Commission Info */}
        {product.commissionInfo?.available && !isCommissionOnly && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-800 text-sm">
              <strong>Commission Available:</strong> Similar pieces starting at {formatPrice(product.commissionInfo.priceRange.min)}
            </p>
            <p className="text-blue-700 text-xs mt-1">
              Estimated completion: {product.commissionInfo.estimatedDays} days
            </p>
          </div>
        )}

        {/* Shipping Info */}
        <div className="flex justify-between items-center text-xs">
          <span>Shipping:</span>
          <span>
            Domestic ${product.shipping.domestic} • International ${product.shipping.international}
          </span>
        </div>

        {/* Specifications */}
        <div className="flex flex-wrap gap-2 text-xs">
          {product.specifications.signed && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">✓ Signed</span>
          )}
          {product.specifications.certificate && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">✓ Certificate</span>
          )}
          {product.specifications.framed && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">✓ Framed</span>
          )}
        </div>
      </div>
    </div>
  );
}
