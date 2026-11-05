'use client';

import { useState } from 'react';
import {
  Product,
  CartItemVariant,
  formatPrice,
  calculateVariantPrice,
  productHasPurchaseOptions,
} from '@/lib/commerce';
import { useCart } from './CartContext';
import ProductVariantSelector from './ProductVariantSelector';
import CustomCommissionRequest from './CustomCommissionRequest';
import { useEcommerceTracking } from './AnalyticsProvider';

interface AddToCartButtonProps {
  product: Product;
  purchasable?: boolean;
  className?: string;
  showVariants?: boolean;
  /** full = shipping + badges (PDP). compact = purchase/commission actions only (quick look). */
  details?: 'full' | 'compact';
  size?: 'sm' | 'md' | 'lg';
}

export default function AddToCartButton({ 
  product,
  purchasable = true,
  className = '', 
  showVariants = true,
  details = 'full',
  size = 'md' 
}: AddToCartButtonProps) {
  const { addItem, openCart, state } = useCart();
  const { trackAddToCart } = useEcommerceTracking();
  const [selectedVariant, setSelectedVariant] = useState<CartItemVariant>({});
  const [customizations, setCustomizations] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [isSubmittingCommission, setIsSubmittingCommission] = useState(false);

  // Check if product is available for purchase
  const isAvailable = product.availability === 'available' && purchasable;
  const isCommissionOnly = product.availability === 'commissioned';
  const isSoldOut = product.availability === 'sold' || product.availability === 'reserved' || (product.availability === 'available' && !purchasable);
  const commissionAvailable = Boolean(product.commissionInfo?.available) || isCommissionOnly;
  const showOptionSelector = showVariants && (
    details === 'full'
      ? productHasPurchaseOptions(product)
      : Boolean(
          product.variants?.sizes?.length
          || product.variants?.framing?.length
          || product.variants?.materials?.length
          || product.customizations?.some((item) => item.type === 'select' || item.required),
        )
  );

  // Helper function to generate item key - moved before usage
  const generateItemKey = (productId: string, variant?: CartItemVariant): string => {
    if (!variant) return productId;
    const parts = [productId];
    if (variant.size) parts.push(`size:${variant.size.id}`);
    if (variant.framing) parts.push(`frame:${variant.framing.id}`);
    if (variant.material) parts.push(`material:${variant.material.id}`);
    return parts.join('|');
  };

  // Check stock for selected variant
  const isInStock = () => {
    if (!selectedVariant.size?.id) return true;
    
    const sizeVariant = product.variants?.sizes?.find(s => s.id === selectedVariant.size?.id);
    return !sizeVariant?.stock || sizeVariant.stock > 0;
  };

  // Check if item is already in cart
  const itemInCart = state.items.find(item => {
    const itemKey = generateItemKey(item.product.id, item.variant);
    const currentKey = generateItemKey(product.id, selectedVariant);
    return itemKey === currentKey;
  });

  const displayPrice = calculateVariantPrice(product.price, selectedVariant);

  const handleVariantChange = (variant: CartItemVariant, customizationValues: Record<string, string>) => {
    setSelectedVariant(variant);
    setCustomizations(customizationValues);
  };

  const handleAddToCart = async () => {
    setIsAdding(true);
    
    try {
      // Validate required customizations
      if (product.customizations) {
        const requiredCustomizations = product.customizations.filter(c => c.required);
        const missingRequired = requiredCustomizations.filter(c => !customizations[c.id]?.trim());
        
        if (missingRequired.length > 0) {
          alert(`Please complete the following required fields: ${missingRequired.map(c => c.name).join(', ')}`);
          return;
        }
      }

      // Check stock availability
      if (!isInStock()) {
        alert('Sorry, this variant is currently out of stock.');
        return;
      }

      addItem(product, 1, selectedVariant, customizations);
      trackAddToCart(product.id, product.title, product.category, displayPrice, 1);
      
      // Brief success feedback
      setTimeout(() => {
        openCart();
      }, 100);
      
    } catch (error) {
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Failed to add item to cart:', error);
      }
      alert('Sorry, there was an error adding this item to your cart. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCommissionSubmit = async (formData: {
    type: 'similar' | 'custom' | 'consultation';
    medium: string;
    dimensions: string;
    description: string;
    budget: { min: number; max: number };
    timeline: string;
    customerInfo: {
      name: string;
      email: string;
      phone?: string;
      preferredContact: 'email' | 'phone';
    };
    specialRequests?: string;
  }) => {
    setIsSubmittingCommission(true);
    
    try {
      const response = await fetch('/api/commission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          productId: product.id,
          variants: {
            size: selectedVariant.size?.name,
            material: selectedVariant.material?.name,
            style: customizations.style,
            background: customizations.background,
            subjects: customizations.subjects
          }
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowCommissionForm(false);
        alert(`Commission request submitted successfully! Request ID: ${result.requestId}\n\nYou will receive a confirmation email shortly.`);
      } else {
        throw new Error(result.error || 'Failed to submit commission request');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Commission submission error:', error);
      }
      alert('Sorry, there was an error submitting your commission request. Please try again.');
    } finally {
      setIsSubmittingCommission(false);
    }
  };

  const buttonSizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

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

  const commissionLabel = isCommissionOnly ? 'Request Commission' : 'Commission a similar piece';
  const commissionHelper = product.commissionInfo
    ? `Similar pieces from ${formatPrice(product.commissionInfo.priceRange.min)} · about ${product.commissionInfo.estimatedDays} days`
    : null;
  const statusLabel = product.availability === 'sold'
    ? 'Sold'
    : product.availability === 'reserved'
      ? 'Reserved'
      : 'Unavailable';

  return (
    <div className={details === 'compact' ? 'space-y-4' : 'space-y-6'}>
      {showOptionSelector && (
        <ProductVariantSelector
          product={product}
          onVariantChange={handleVariantChange}
          onPriceChange={() => {}}
          density={details === 'compact' ? 'compact' : 'full'}
        />
      )}

      <div className="space-y-3">
        {isSoldOut && (
          <p
            className={`w-full rounded-lg bg-gray-100 text-center font-medium text-gray-600 ${buttonSizes[size]}`}
            role="status"
          >
            {statusLabel}
          </p>
        )}

        {isAvailable && (
          <button
            onClick={handleAddToCart}
            data-testid="add-to-cart"
            disabled={isAdding || !isInStock()}
            className={`w-full font-medium rounded-lg transition-all duration-200 ${buttonSizes[size]} ${
              isAdding || !isInStock()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'btn-primary shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 motion-reduce:transform-none'
            } ${className}`}
          >
            {isAdding ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding to Cart...
              </span>
            ) : !isInStock() ? (
              'Out of Stock'
            ) : itemInCart ? (
              `Update Cart (${formatPrice(displayPrice)})`
            ) : (
              `Add to Cart • ${formatPrice(displayPrice)}`
            )}
          </button>
        )}

        {commissionAvailable && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowCommissionForm(true)}
              className={`w-full font-medium rounded-lg transition-all duration-200 ${buttonSizes[size]} ${className} ${
                isCommissionOnly || isSoldOut
                  ? 'btn-primary shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 motion-reduce:transform-none'
                  : 'btn-primary-outline'
              }`}
            >
              {commissionLabel}
            </button>
            {commissionHelper && (
              <p className="text-center text-xs text-gray-600">{commissionHelper}</p>
            )}
          </div>
        )}
      </div>

      {(product.edition || details === 'full') && (
        <div className="space-y-2 text-sm text-gray-600">
          {product.edition && (
            <div className="flex items-center justify-between">
              <span>Limited Edition:</span>
              <span className="font-medium">
                {product.edition.remaining} of {product.edition.total} remaining
              </span>
            </div>
          )}

          {details === 'full' && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span>Shipping:</span>
                <span>
                  Domestic ${product.shipping.domestic} • International ${product.shipping.international}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {product.specifications.signed && (
                  <span className="rounded bg-green-100 px-2 py-1 text-green-800">✓ Signed</span>
                )}
                {product.specifications.certificate && (
                  <span className="rounded bg-green-100 px-2 py-1 text-green-800">✓ Certificate</span>
                )}
                {product.specifications.framed && (
                  <span className="rounded bg-blue-100 px-2 py-1 text-blue-800">✓ Framed</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}