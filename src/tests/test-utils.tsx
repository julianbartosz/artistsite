// Test utilities for common testing patterns
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

// Custom render function that can be extended with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { ...options });

// Mock data factories
export const createMockProduct = (overrides = {}) => ({
  id: 'test-product',
  title: 'Test Product',
  price: 100,
  currency: 'USD',
  category: 'test',
  availability: 'available',
  featured: false,
  description: 'Test description',
  medium: 'Test medium',
  dimensions: '10" x 10"',
  year: 2024,
  images: {
    thumbnail: '/test.jpg',
    gallery: ['/test.jpg'],
  },
  tags: ['test'],
  shipping: { domestic: 10, international: 20 },
  specifications: { framed: false, signed: true, certificate: false },
  ...overrides,
});

export const createMockBlogPost = (overrides = {}) => ({
  slug: 'test-post',
  title: 'Test Post',
  excerpt: 'Test excerpt',
  publishedAt: '2024-01-01',
  tags: ['test'],
  isDraft: false,
  author: 'Artist',
  ...overrides,
});

// Mock API responses
export const mockApiResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };