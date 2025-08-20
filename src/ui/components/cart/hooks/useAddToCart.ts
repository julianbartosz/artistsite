// filepath: src/ui/components/cart/hooks/useAddToCart.ts
'use client';
import { useState } from 'react';
import { useCart } from '@ui/components/cart/context/CartContext';
import type { Product, CartItemVariant } from '@domain/shop';
import { formatPrice } from '@domain/shop';

export interface CommissionFormData {
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
}

export function useAddToCart(product: Product) {
  const { addItem, openCart, state } = useCart();

  const [selectedVariant, setSelectedVariant] = useState<CartItemVariant>({});
  const [customizations, setCustomizations] = useState<Record<string, string>>({});
  const [currentPrice, setCurrentPrice] = useState(product.price);
  const [isAdding, setIsAdding] = useState(false);
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [isSubmittingCommission, setIsSubmittingCommission] = useState(false);

  const isAvailable = product.availability === 'available';
  const isCommissionOnly = product.availability === 'commissioned';
  const isSoldOut = product.availability === 'sold' || product.availability === 'reserved';

  const isInStock = () => {
    if (!selectedVariant.size?.id) return true;
    const sizeVariant = product.variants?.sizes?.find((s) => s.id === selectedVariant.size?.id);
    return !sizeVariant?.stock || sizeVariant.stock > 0;
  };

  const generateItemKey = (productId: string, variant?: CartItemVariant): string => {
    if (!variant) return productId;
    const parts = [productId];
    if (variant.size) parts.push(`size:${variant.size.id}`);
    if (variant.framing) parts.push(`frame:${variant.framing.id}`);
    if (variant.material) parts.push(`material:${variant.material.id}`);
    return parts.join('|');
  };

  const itemInCart = state.items.find((item) => {
    const itemKey = generateItemKey(item.product.id, item.variant);
    const currentKey = generateItemKey(product.id, selectedVariant);
    return itemKey === currentKey;
  });

  const handleVariantChange = (
    variant: CartItemVariant,
    customizationValues: Record<string, string>
  ) => {
    setSelectedVariant(variant);
    setCustomizations(customizationValues);
  };

  const handlePriceChange = (totalPrice: number) => setCurrentPrice(totalPrice);

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      if (product.customizations) {
        const required = product.customizations.filter((c) => c.required);
        const missing = required.filter((c) => !customizations[c.id]?.trim());
        if (missing.length > 0) {
          alert(
            `Please complete the following required fields: ${missing
              .map((c) => c.name)
              .join(', ')}`
          );
          return;
        }
      }

      if (!isInStock()) {
        alert('Sorry, this variant is currently out of stock.');
        return;
      }

      addItem(product, 1, selectedVariant, customizations);
      setTimeout(() => openCart(), 100);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Failed to add item to cart:', error);
      }
      alert('Sorry, there was an error adding this item to your cart. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCommissionSubmit = async (formData: CommissionFormData) => {
    setIsSubmittingCommission(true);
    try {
      const response = await fetch('/api/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          productId: product.id,
          variants: {
            size: selectedVariant.size?.name,
            material: selectedVariant.material?.name,
            style: customizations.style,
            background: customizations.background,
            subjects: customizations.subjects,
          },
        }),
      });
      const result = await response.json();
      if (result.success) {
        setShowCommissionForm(false);
        alert(
          `Commission request submitted successfully! Request ID: ${result.requestId}\n\nYou will receive a confirmation email shortly.`
        );
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

  return {
    selectedVariant,
    customizations,
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
    formatPrice, // convenience passthrough for UI
  };
}
