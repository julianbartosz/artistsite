'use client';

import { useState } from 'react';
import { Product, CartItemVariant, formatPrice } from '@/lib/commerce';
import { useCart } from './CartContext';
import ProductVariantSelector from './ProductVariantSelector';
import CustomCommissionRequest from './CustomCommissionRequest';

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
  size = 'md' 
}: AddToCartButtonProps) {
  const { addItem, openCart, state } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<CartItemVariant>({});
  const [customizations, setCustomizations] = useState<Record<string, string>>({});
  const [currentPrice, setCurrentPrice] = useState(product.price);
  const [isAdding, setIsAdding] = useState(false);
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [isSubmittingCommission, setIsSubmittingCommission] = useState(false);

  // Check if product is available for purchase
  const isAvailable = product.availability === 'available';
  const isCommissionOnly = product.availability === 'commissioned';
  const isSoldOut = product.availability === 'sold' || product.availability === 'reserved';

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

  const handleVariantChange = (variant: CartItemVariant, customizationValues: Record<string, string>) => {
    setSelectedVariant(variant);
    setCustomizations(customizationValues);
  };

  const handlePriceChange = (totalPrice: number) => {
    setCurrentPrice(totalPrice);
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

  return (
    <div className="space-y-6">
      {/* Product Variants */}
      {showVariants && (product.variants || product.customizations) && (
        <ProductVariantSelector
          product={product}
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
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
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
            <div className={`w-full font-medium rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed ${buttonSizes[size]}`}>
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
        {/* Stock Info */}
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