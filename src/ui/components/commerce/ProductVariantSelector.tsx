'use client';
import { useEffect, useState, useCallback } from 'react';
import { Product, ProductVariant, CartItemVariant, validateCustomizations } from '@domain/shop';
import { VariantOptions } from '../commerce/product-variant/VariantOptions';
import { CustomizationField } from '../commerce/product-variant/CustomizationField';
import { PriceSummary } from '../commerce/product-variant/PriceSummary';

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
  initialCustomizations = {},
}: ProductVariantSelectorProps) {
  const [selectedVariant, setSelectedVariant] = useState<CartItemVariant>(initialVariant || {});
  const [customizations, setCustomizations] = useState<Record<string, string>>(initialCustomizations);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(product.price);

  useEffect(() => {
    let totalPrice = product.price;
    if (selectedVariant.size) totalPrice += selectedVariant.size.priceModifier;
    if (selectedVariant.framing) totalPrice += selectedVariant.framing.priceModifier;
    if (selectedVariant.material) totalPrice += selectedVariant.material.priceModifier;
    if (selectedVariant.customizations) {
      totalPrice += selectedVariant.customizations.reduce(
        (sum: number, custom: { priceModifier: number }) => sum + custom.priceModifier,
        0,
      );
    }
    setCurrentPrice(totalPrice);
    onPriceChange(totalPrice);
  }, [selectedVariant, product.price, onPriceChange]);

  useEffect(() => {
    if (product.customizations) {
      const validation = validateCustomizations(product.customizations, customizations);
      setValidationErrors(validation.errors);
    }
    onVariantChange(selectedVariant, customizations);
  }, [selectedVariant, customizations, product.customizations, onVariantChange]);

  const handleVariantSelection = useCallback(
    (type: 'size' | 'framing' | 'material', variant: { id: string; name: string; priceModifier: number }) => {
      setSelectedVariant((prev: CartItemVariant) => ({
        ...prev,
        [type]: { id: variant.id, name: variant.name, priceModifier: variant.priceModifier },
      }));
    },
    [],
  );

  const handleCustomizationChange = useCallback(
    (customizationId: string, value: string) => {
      setCustomizations((prev) => ({ ...prev, [customizationId]: value }));
      const customization = product.customizations?.find((c) => c.id === customizationId);
      if (customization && customization.type === 'select' && customization.options) {
        const selectedOption = customization.options.find((opt) => opt.id === value);
        if (selectedOption) {
          setSelectedVariant((prev: CartItemVariant) => ({
            ...prev,
            customizations: [
              ...((prev.customizations?.filter((c: { id: string }) => c.id !== customizationId)) || []),
              {
                id: customizationId,
                name: customization.name,
                value: selectedOption.name,
                priceModifier: selectedOption.price,
              },
            ],
          }));
        }
      }
    },
    [product.customizations],
  );

  if (!product.variants && !product.customizations) return null;

  return (
    <div className="space-y-6">
      {product.variants?.sizes && (
        <VariantOptions
          label="Size Options"
          variants={product.variants.sizes as unknown as ProductVariant[]}
          selectedId={selectedVariant.size?.id}
          onSelect={(v) => handleVariantSelection('size', v)}
        />
      )}

      {product.variants?.framing && (
        <VariantOptions
          label="Framing Options"
          variants={product.variants.framing as unknown as ProductVariant[]}
          selectedId={selectedVariant.framing?.id}
          onSelect={(v) => handleVariantSelection('framing', v)}
        />
      )}

      {product.variants?.materials && (
        <VariantOptions
          label="Material Options"
          variants={product.variants.materials as unknown as ProductVariant[]}
          selectedId={selectedVariant.material?.id}
          onSelect={(v) => handleVariantSelection('material', v)}
        />
      )}

      {product.customizations && product.customizations.length > 0 && (
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-4">Customization Options</h4>
          {product.customizations.map((customization) => (
            <CustomizationField
              key={customization.id}
              customization={customization}
              value={customizations[customization.id] || ''}
              hasError={validationErrors.some((error) => error.includes(customization.name))}
              onChange={handleCustomizationChange}
            />
          ))}
        </div>
      )}

      <PriceSummary base={product.price} current={currentPrice} />
    </div>
  );
}
