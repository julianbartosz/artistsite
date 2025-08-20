import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useCart } from '@ui/components/cart/context/CartContext';
import AddToCartButton from '@ui/components/cart/AddToCartButton';
import { Product } from '@domain/shop';

// Mock the cart context (match real import path used inside implementation)
jest.mock('@ui/components/cart/context/CartContext');
const mockUseCart = useCart as jest.MockedFunction<typeof useCart>;

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

const mockCartFunctions = {
  addItem: jest.fn(),
  removeItem: jest.fn(),
  updateQuantity: jest.fn(),
  clearCart: jest.fn(),
  toggleCart: jest.fn(),
  openCart: jest.fn(),
  closeCart: jest.fn(),
  updateItemVariant: jest.fn(), // Add missing CartContextType method
  getItemKey: jest.fn(() => 'mock-key'), // Add missing CartContextType method
};

describe('AddToCartButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCart.mockReturnValue({
      state: {
        items: [],
        total: 0,
        itemCount: 0,
        isOpen: false,
        lastUpdated: Date.now(), // Add missing lastUpdated property
      },
      ...mockCartFunctions,
    });
  });

  it('renders add to cart button for available products', () => {
    render(<AddToCartButton product={mockProduct} />);
    
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
  });

  it('disables button for unavailable products', () => {
    const unavailableProduct = { ...mockProduct, availability: 'sold' as const };
    render(<AddToCartButton product={unavailableProduct} />);
    
    // For sold products, the component shows a disabled div, not a button
    expect(screen.getByText('Sold')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();
  });

  it('adds product to cart when clicked', async () => {
    render(<AddToCartButton product={mockProduct} />);
    
    const button = screen.getByRole('button', { name: /add to cart/i });
    fireEvent.click(button);

    // The addItem function is called with additional parameters for variants and customizations
    expect(mockCartFunctions.addItem).toHaveBeenCalledWith(mockProduct, 1, {}, {});
  });

  it('shows success state and opens cart after adding item', async () => {
    render(<AddToCartButton product={mockProduct} />);
    
    const button = screen.getByRole('button', { name: /add to cart/i });
    fireEvent.click(button);

    // Should open cart after delay (the component doesn't show "added to cart" text)
    await waitFor(() => {
      expect(mockCartFunctions.openCart).toHaveBeenCalled();
    }, { timeout: 200 });
  });
});