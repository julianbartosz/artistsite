import { ProductCustomization, formatPrice } from '@domain/shop'

type Props = {
  customization: ProductCustomization
  value: string
  hasError: boolean
  onChange: (id: string, value: string) => void
}

export function CustomizationField({ customization, value, hasError, onChange }: Props) {
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
            onChange={(e) => onChange(customization.id, e.target.value)}
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
      )
    case 'textarea':
      return (
        <div key={customization.id} className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {customization.name}
            {customization.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            value={value}
            onChange={(e) => onChange(customization.id, e.target.value)}
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
      )
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
            onChange={(e) => onChange(customization.id, e.target.value)}
            placeholder={customization.placeholder}
            maxLength={customization.maxLength}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
              hasError ? 'border-red-300' : 'border-gray-300'
            }`}
            required={customization.required}
          />
        </div>
      )
    case 'checkbox':
      return (
        <div key={customization.id} className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => onChange(customization.id, e.target.checked.toString())}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              {customization.name}
              {customization.required && <span className="text-red-500 ml-1">*</span>}
            </span>
          </label>
        </div>
      )
    default:
      return null
  }
}
