import { formatPrice } from '@domain/shop'

export function PriceSummary({ base, current }: { base: number; current: number }) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">Total Price:</span>
        <span className="text-xl font-bold text-gray-900">{formatPrice(current)}</span>
      </div>
      {current !== base && (
        <div className="text-sm text-gray-500 mt-1">
          Base price: {formatPrice(base)}
          {current > base && ` + ${formatPrice(current - base)} in options`}
        </div>
      )}
    </div>
  )
}
