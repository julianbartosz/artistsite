import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { InventoryTable } from './InventoryTable'
import type { Product } from '@domain/shop'

jest.mock('@ui/components/commerce/StockIndicator', () => ({
  __esModule: true,
  default: ({ productId }: { productId: string }) => <span data-testid={`stock-${productId}`}>Stock OK</span>,
}))

describe('InventoryTable', () => {
  const products: Product[] = [
    {
      id: 'prod_1',
      title: 'Sunset Painting',
      description: 'A beautiful sunset',
      price: 2500,
      currency: 'USD',
      category: 'painting',
      medium: 'oil on canvas',
      dimensions: '24x36',
      year: 2023,
      availability: 'available',
      featured: true,
      images: { thumbnail: '/images/test1.jpg', gallery: [] },
      tags: [],
      shipping: { domestic: 20, international: 50 },
      specifications: { framed: false, signed: true, certificate: true },
    },
    {
      id: 'prod_2',
      title: 'Mountain Sketch',
      description: 'Black and white sketch',
      price: 800,
      currency: 'USD',
      category: 'drawing',
      medium: 'charcoal',
      dimensions: '18x24',
      year: 2022,
      availability: 'available',
      featured: false,
      images: { thumbnail: '/images/test2.jpg', gallery: [] },
      tags: [],
      shipping: { domestic: 10, international: 30 },
      specifications: { framed: false, signed: false, certificate: false },
    }
  ]

  it('renders product rows with image, title, and price', () => {
    render(<InventoryTable products={products} />)

    expect(screen.getByText('Product Inventory')).toBeInTheDocument()

    const rows = screen.getAllByRole('row')
    // first row is header, next are products
    const productRows = rows.slice(1)
    expect(productRows).toHaveLength(2)

    const firstRow = productRows[0]
    expect(within(firstRow).getByText('Sunset Painting')).toBeInTheDocument()
    expect(within(firstRow).getByText(/\$2,500/)).toBeInTheDocument()
    expect(within(firstRow).getByTestId('stock-prod_1')).toBeInTheDocument()
  })
})
