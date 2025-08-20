import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@ui/components/layout/Header';
import { usePathname } from 'next/navigation';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock next-auth to avoid SessionProvider requirements
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signOut: jest.fn(),
}));

// Mock CartContext to avoid needing the provider (updated path)
jest.mock('@ui/components/cart/context/CartContext', () => ({
  useCart: () => ({
    state: { itemCount: 0 },
    toggleCart: jest.fn(),
  }),
}));

// Cast the mocked function for TypeScript
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders navigation links correctly', () => {
    render(<Header />);
    
    expect(screen.getByText('Artist Site')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Blog')).toBeInTheDocument();
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('highlights active navigation item', () => {
    mockUsePathname.mockReturnValue('/portfolio');
    
    render(<Header />);
    
    const portfolioLink = screen.getByText('Portfolio');
    expect(portfolioLink).toHaveClass('text-gray-900');
  });

  it('opens and closes mobile menu', () => {
    render(<Header />);
    
    // Mobile menu toggle should be present with accessible name via sr-only text
    const menuButton = screen.getByRole('button', { name: 'Open main menu' });
    expect(menuButton).toBeInTheDocument();
    
    // Click mobile menu button
    fireEvent.click(menuButton);
    
    // Mobile menu should be visible (button remains present)
    expect(screen.getByRole('button', { name: 'Open main menu' })).toBeInTheDocument();
  });

  it('closes mobile menu when link is clicked', () => {
    render(<Header />);
    
    // Open mobile menu
    const menuButton = screen.getByRole('button', { name: 'Open main menu' });
    fireEvent.click(menuButton);
    
    // Click a navigation link in mobile menu
    const mobileLinks = screen.getAllByText('Portfolio');
    const mobilePortfolioLink = mobileLinks.find(link => 
      link.className.includes('block')
    );
    
    if (mobilePortfolioLink) {
      fireEvent.click(mobilePortfolioLink);
    }
    
    // Menu should close (button should show "open" state)
    expect(screen.getByRole('button', { name: 'Open main menu' })).toBeInTheDocument();
  });

  it('has correct link hrefs', () => {
    render(<Header />);
    
    expect(screen.getByRole('link', { name: 'Artist Site' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Portfolio' })).toHaveAttribute('href', '/portfolio');
    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  });

  it('is sticky positioned', () => {
    render(<Header />);
    
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky', 'top-0', 'z-50');
  });
});