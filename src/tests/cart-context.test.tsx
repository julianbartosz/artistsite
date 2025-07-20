import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from '@/components/CartContext';
import { Product } from '@/lib/commerce';

const mockProduct: Product = {
  id: 'test-product',
  title: 'Test Artwork',
  description: 'A beautiful test piece',
  price: 100,
  currency: 'USD',
  category: 'paintings',
  medium: 'Oil on canvas',
  dimensions: '12" x 16"',
  year: 2024,
  availability: 'available',
  featured: false,
  images: {
    thumbnail: '/test-image.jpg',
    gallery: ['/test-image.jpg'],
  },
  tags: ['test', 'art'],
  shipping: {
    domestic: 15,
    international: 45,
  },
  specifications: {
    framed: false,
    signed: true,
    certificate: true,
  },
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

describe('CartContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('initializes with empty cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.state.items).toEqual([]);
    expect(result.current.state.total).toBe(0);
    expect(result.current.state.itemCount).toBe(0);
    expect(result.current.state.isOpen).toBe(false);
  });

  it('adds item to cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(mockProduct, 1);
    });

    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.items[0].product.id).toBe('test-product');
    expect(result.current.state.items[0].quantity).toBe(1);
    expect(result.current.state.total).toBe(100);
    expect(result.current.state.itemCount).toBe(1);
  });

  it('updates quantity when adding existing item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(mockProduct, 1);
    });

    act(() => {
      result.current.addItem(mockProduct, 2);
    });

    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.items[0].quantity).toBe(3);
    expect(result.current.state.total).toBe(300);
    expect(result.current.state.itemCount).toBe(3);
  });

  it('removes item from cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(mockProduct, 2);
    });

    act(() => {
      result.current.removeItem('test-product');
    });

    expect(result.current.state.items).toHaveLength(0);
    expect(result.current.state.total).toBe(0);
    expect(result.current.state.itemCount).toBe(0);
  });

  it('updates item quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(mockProduct, 2);
    });

    act(() => {
      result.current.updateQuantity('test-product', 5);
    });

    expect(result.current.state.items[0].quantity).toBe(5);
    expect(result.current.state.total).toBe(500);
    expect(result.current.state.itemCount).toBe(5);
  });

  it('removes item when quantity is set to 0', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(mockProduct, 2);
    });

    act(() => {
      result.current.updateQuantity('test-product', 0);
    });

    expect(result.current.state.items).toHaveLength(0);
    expect(result.current.state.total).toBe(0);
    expect(result.current.state.itemCount).toBe(0);
  });

  it('clears entire cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(mockProduct, 2);
      result.current.addItem({ ...mockProduct, id: 'product-2' }, 1);
    });

    act(() => {
      result.current.clearCart();
    });

    expect(result.current.state.items).toHaveLength(0);
    expect(result.current.state.total).toBe(0);
    expect(result.current.state.itemCount).toBe(0);
  });

  it('toggles cart open/closed', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.toggleCart();
    });

    expect(result.current.state.isOpen).toBe(true);

    act(() => {
      result.current.toggleCart();
    });

    expect(result.current.state.isOpen).toBe(false);
  });

  it('opens and closes cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.openCart();
    });

    expect(result.current.state.isOpen).toBe(true);

    act(() => {
      result.current.closeCart();
    });

    expect(result.current.state.isOpen).toBe(false);
  });
});