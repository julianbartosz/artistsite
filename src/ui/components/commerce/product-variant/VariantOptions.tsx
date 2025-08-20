import { ProductVariant, formatPrice } from '@domain/shop'

type Props = {
  label: string
  variants: ProductVariant[]
  selectedId?: string
  onSelect: (variant: ProductVariant) => void
}

export function VariantOptions({ label, variants, selectedId, onSelect }: Props) {
  if (!variants?.length) return null
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-3">{label}</label>
      <div className="grid grid-cols-1 gap-2">
        {variants.map((variant) => {
          const isSelected = selectedId === variant.id
          return (
            <button
              key={variant.id}
              onClick={() => onSelect(variant)}
              className={`p-3 border rounded-lg text-left transition-colors ${
                isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{variant.name}</span>
                <span
                  className={`text-sm ${
                    variant.priceModifier === 0
                      ? 'text-gray-500'
                      : variant.priceModifier > 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {variant.priceModifier === 0
                    ? 'Included'
                    : variant.priceModifier > 0
                    ? `+${formatPrice(variant.priceModifier)}`
                    : formatPrice(variant.priceModifier)}
                </span>
              </div>
              {variant.stock !== undefined && (
                <div className="text-xs text-gray-500 mt-1">
                  {variant.stock > 0 ? `${variant.stock} available` : 'Out of stock'}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
