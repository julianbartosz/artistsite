'use client';

import { useState, useEffect } from 'react';
import { Product, ProductVariant, ProductCustomization, CartItemVariant, validateCustomizations, formatPrice } from '@/lib/commerce';

interface ProductVariantSelectorProps {
  product: Product;
  onVariantChange: (variant: CartItemVariant, customizations: Record<string, string>) => void;
  onPriceChange: (totalPrice: number) => void;
  initialVariant?: CartItemVariant;
  initialCustomizations?: Record<string, string>;
}

export default function ProductVariantSelector({
  product,
  onVariantChange,
  onPriceChange,
  initialVariant,
  initialCustomizations = {}
}: ProductVariantSelectorProps) {
  const [selectedVariant, setSelectedVariant] = useState<CartItemVariant>(initialVariant || {});
  const [customizations, setCustomizations] = useState<Record<string, string>>(initialCustomizations);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [currentPrice, setCurrentPrice] = useState(product.price);

  // Calculate total price including variants and customizations
  useEffect(() => {
    let totalPrice = product.price;
    
    if (selectedVariant.size) totalPrice += selectedVariant.size.price;
    if (selectedVariant.framing) totalPrice += selectedVariant.framing.price;
    if (selectedVariant.material) totalPrice += selectedVariant.material.price;
    if (selectedVariant.customizations) {
      totalPrice += selectedVariant.customizations.reduce((sum, custom) => sum + custom.price, 0);
    }
    
    setCurrentPrice(totalPrice);
    onPriceChange(totalPrice);
  }, [selectedVariant, product.price, onPriceChange]);

  // Validate customizations and notify parent of changes
  useEffect(() => {
    if (product.customizations) {
      const validation = validateCustomizations(product.customizations, customizations);
      setValidationErrors(validation.errors);
    }
    
    onVariantChange(selectedVariant, customizations);
  }, [selectedVariant, customizations, product.customizations, onVariantChange]);

  const handleVariantSelection = (
    type: 'size' | 'framing' | 'material',
    variant: ProductVariant
  ) => {
    setSelectedVariant(prev => ({
      ...prev,
      [type]: {
        id: variant.id,
        name: variant.name,
        price: variant.priceModifier
      }
    }));
  };

  const handleCustomizationChange = (customizationId: string, value: string) => {
    setCustomizations(prev => ({
      ...prev,
      [customizationId]: value
    }));

    // Update variant customizations for price calculation
    const customization = product.customizations?.find(c => c.id === customizationId);
    if (customization && customization.type === 'select' && customization.options) {
      const selectedOption = customization.options.find(opt => opt.id === value);
      if (selectedOption) {
        setSelectedVariant(prev => ({
          ...prev,
          customizations: [
            ...(prev.customizations?.filter(c => c.id !== customizationId) || []),
            {
              id: customizationId,
              name: customization.name,
              value: selectedOption.name,
              price: selectedOption.price
            }
          ]
        }));
      }
    }
  };

  const renderVariantOptions = (
    type: 'size' | 'framing' | 'material',
    variants: ProductVariant[],
    label: string
  ) => (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-3">{label}</label>
      <div className="grid grid-cols-1 gap-2">
        {variants.map((variant) => {
          const isSelected = selectedVariant[type]?.id === variant.id;
          return (
            <button
              key={variant.id}
              onClick={() => handleVariantSelection(type, variant)}
              className={`p-3 border rounded-lg text-left transition-colors ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{variant.name}</span>
                <span className={`text-sm ${
                  variant.priceModifier === 0 ? 'text-gray-500' : 
                  variant.priceModifier > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {variant.priceModifier === 0 ? 'Included' : 
                   variant.priceModifier > 0 ? `+${formatPrice(variant.priceModifier)}` : 
                   formatPrice(variant.priceModifier)}
                </span>
              </div>
              {variant.stock !== undefined && (
                <div className="text-xs text-gray-500 mt-1">
                  {variant.stock > 0 ? `${variant.stock} available` : 'Out of stock'}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderCustomization = (customization: ProductCustomization) => {
    const value = customizations[customization.id] || '';
    const hasError = validationErrors.some(error => error.includes(customization.name));

    switch (customization.type) {
      case 'select':
        return (
          <div key={customization.id} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {customization.name}
              {customization.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleCustomizationChange(customization.id, e.target.value)}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                hasError ? 'border-red-300' : 'border-gray-300'
              }`}
              required={customization.required}
            >
              <option value="">Select an option...</option>
              {customization.options?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} {option.price > 0 && `(+${formatPrice(option.price)})`}
                </option>
              ))}
            </select>
          </div>
        );

      case 'textarea':
        return (
          <div key={customization.id} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {customization.name}
              {customization.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleCustomizationChange(customization.id, e.target.value)}
              placeholder={customization.placeholder}
              maxLength={customization.maxLength}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                hasError ? 'border-red-300' : 'border-gray-300'
              }`}
              rows={4}
              required={customization.required}
            />
            {customization.maxLength && (
              <div className="text-xs text-gray-500 mt-1">
                {value.length}/{customization.maxLength} characters
              </div>
            )}
          </div>
        );

      case 'input':
        return (
          <div key={customization.id} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {customization.name}
              {customization.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleCustomizationChange(customization.id, e.target.value)}
              placeholder={customization.placeholder}
              maxLength={customization.maxLength}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                hasError ? 'border-red-300' : 'border-gray-300'
              }`}
              required={customization.required}
            />
          </div>
        );

      case 'checkbox':
        return (
          <div key={customization.id} className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={value === 'true'}
                onChange={(e) => handleCustomizationChange(customization.id, e.target.checked.toString())}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                {customization.name}
                {customization.required && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  if (!product.variants && !product.customizations) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Size Variants */}
      {product.variants?.sizes && product.variants.sizes.length > 0 && 
        renderVariantOptions('size', product.variants.sizes, 'Size Options')
      }

      {/* Framing Variants */}
      {product.variants?.framing && product.variants.framing.length > 0 && 
        renderVariantOptions('framing', product.variants.framing, 'Framing Options')
      }

      {/* Material Variants */}
      {product.variants?.materials && product.variants.materials.length > 0 && 
        renderVariantOptions('material', product.variants.materials, 'Material Options')
      }

      {/* Custom Configurations */}
      {product.customizations && product.customizations.length > 0 && (
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-4">Customization Options</h4>
          {product.customizations.map(renderCustomization)}
        </div>
      )}

      {/* Price Display */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Price:</span>
          <span className="text-xl font-bold text-gray-900">
            {formatPrice(currentPrice)}
          </span>
        </div>
        {currentPrice !== product.price && (
          <div className="text-sm text-gray-500 mt-1">
            Base price: {formatPrice(product.price)} 
            {currentPrice > product.price && 
              ` + ${formatPrice(currentPrice - product.price)} in options`
            }
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h5 className="text-sm font-medium text-red-800 mb-2">Please correct the following:</h5>
          <ul className="text-sm text-red-700 space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}