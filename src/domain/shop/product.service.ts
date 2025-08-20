import type { Product, ProductCustomization, CartItemVariant } from '@domain/shop/product.types'
import { getProductById, getAllProducts } from '@domain/shop/product.repo.json'
import { debug } from '@/lib/debug'

export function calculateVariantPrice(basePrice: number, variants?: CartItemVariant): number {
  let totalPrice = basePrice
  if (variants?.size) totalPrice += variants.size.priceModifier
  if (variants?.framing) totalPrice += variants.framing.priceModifier
  if (variants?.material) totalPrice += variants.material.priceModifier
  if (variants?.customizations) {
    totalPrice += variants.customizations.reduce((sum, custom) => sum + custom.priceModifier, 0)
  }
  return totalPrice
}

export function formatPrice(price: number | undefined | null, currency: string = 'USD'): string {
  if (price === undefined || price === null) {
    debug.warn('formatPrice called with undefined/null price', { price, currency })
    return 'Price not available'
  }
  if (isNaN(price) || price < 0) {
    debug.warn('formatPrice called with invalid price', { price, currency, type: typeof price })
    return 'Price not available'
  }
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price)
  } catch (error) {
    debug.error('Error formatting price', error as Error, { price, currency })
    return 'Price not available'
  }
}

export function validateCustomizations(
  customizations: ProductCustomization[],
  values: Record<string, string>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  customizations.forEach(custom => {
    const value = values[custom.id]
    if (custom.required && (!value || value.trim() === '')) {
      errors.push(`${custom.name} is required`)
      return
    }
    if (value && custom.maxLength && value.length > custom.maxLength) {
      errors.push(`${custom.name} must be ${custom.maxLength} characters or less`)
    }
    if (custom.type === 'select' && value && custom.options) {
      const validOption = custom.options.some(opt => opt.id === value)
      if (!validOption) {
        errors.push(`Invalid selection for ${custom.name}`)
      }
    }
  })
  return { isValid: errors.length === 0, errors }
}

export function getRelatedProducts(productId: string, limit: number = 4): Product[] {
  const product = getProductById(productId)
  if (!product) return []
  // First try explicit related products
  if (product.relatedProducts) {
    const related = product.relatedProducts
      .map(id => getProductById(id))
      .filter(Boolean) as Product[]
    if (related.length >= limit) return related.slice(0, limit)
  }
  // Fall back to products with similar tags or category
  const all = getAllProducts()
  const similar = all.filter(p =>
    p.id !== productId &&
    p.availability === 'available' &&
    (p.category === product.category || product.tags.some(tag => p.tags.includes(tag)))
  )
  return similar.slice(0, limit)
}

export function calculateTotal(price: number, shipping: number): number {
  return price + shipping
}
