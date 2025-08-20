import products from '@content/shop/products.json'
import type { Product } from '@domain/shop/product.types'
import { debug } from '@/lib/debug'

// Repository functions for product data sourced from JSON
export function getAllProducts(): Product[] {
  return products as Product[]
}
export function getAvailableProducts(): Product[] {
  return (products as Product[]).filter(
    p => p.availability === 'available' || p.availability === 'commissioned'
  )
}
export function getFeaturedProducts(): Product[] {
  return (products as Product[]).filter(
    p => p.featured && (p.availability === 'available' || p.availability === 'commissioned')
  )
}
export function getProductsByCategory(category: string): Product[] {
  return (products as Product[]).filter(p => p.category === category)
}
export function getProductsByTag(tag: string): Product[] {
  return (products as Product[]).filter(p => p.tags.includes(tag))
}
export function getProductById(id: string): Product | undefined {
  try {
    const product = (products as Product[]).find(p => p.id === id)
    if (product) {
      if (typeof product.price !== 'number' || product.price < 0) {
        debug.error('Invalid product price detected', undefined, { id, price: product.price, type: typeof product.price })
        return undefined
      }
      if (!product.currency) {
        debug.warn('Product missing currency, defaulting to USD', { id })
        product.currency = 'USD'
      }
    }
    return product
  } catch (error) {
    debug.error('Error retrieving product', error as Error, { id })
    return undefined
  }
}
export function getCategories(): string[] {
  const categories = (products as Product[]).map(p => p.category)
  return [...new Set(categories)]
}
