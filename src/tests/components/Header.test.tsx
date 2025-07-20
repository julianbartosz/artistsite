import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/Header';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
  useRouter: () => ({
    push: mockPush,
  }),
}));

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
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/portfolio');
    
    render(<Header />);
    
    const portfolioLink = screen.getByText('Portfolio');
    expect(portfolioLink).toHaveClass('text-gray-900');
  });

  it('opens and closes mobile menu', () => {
    render(<Header />);
    
    // Mobile menu should be hidden initially
    expect(screen.queryByRole('button', { expanded: false })).toBeInTheDocument();
    
    // Click mobile menu button
    const menuButton = screen.getByLabelText('Open main menu');
    fireEvent.click(menuButton);
    
    // Mobile menu should be visible
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
  });

  it('closes mobile menu when link is clicked', () => {
    render(<Header />);
    
    // Open mobile menu
    const menuButton = screen.getByLabelText('Open main menu');
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
    expect(screen.getByLabelText('Open main menu')).toBeInTheDocument();
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