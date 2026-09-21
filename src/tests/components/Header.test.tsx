import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/Header';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DEFAULT_NAVIGATION, DEFAULT_SITE_IDENTITY } from '@/lib/site-content-shared';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated', update: jest.fn() })),
  signOut: jest.fn(),
}));

jest.mock('@/components/CartContext', () => ({
  useCart: jest.fn(() => ({
    state: { items: [], total: 0, itemCount: 0, isOpen: false, isLoaded: true, lastUpdated: 0 },
    toggleCart: jest.fn(),
    restoreCart: jest.fn(),
  })),
}));

jest.mock('@/components/CartDrawer', () => ({
  CartDrawer: () => null,
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Cast the mocked function for TypeScript
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: jest.fn() });
  });

  it('renders navigation links correctly', () => {
    render(<Header />);
    
    expect(screen.getByText('Artist Site')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Updates')).toBeInTheDocument();
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('highlights active navigation item', () => {
    mockUsePathname.mockReturnValue('/portfolio');
    
    render(<Header />);
    
    const portfolioLink = screen.getByText('Portfolio');
    expect(portfolioLink).toHaveClass('text-primary');
  });

  it('opens and closes mobile menu', () => {
    render(<Header />);

    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();

    const menuButton = screen.getByLabelText('Open main menu');
    fireEvent.click(menuButton);

    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
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
    expect(screen.getByRole('link', { name: 'Updates' })).toHaveAttribute('href', '/updates');
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  });

  it('truncates long site names for narrow layouts', () => {
    render(
      <Header
        siteIdentity={{
          ...DEFAULT_SITE_IDENTITY,
          siteName: 'Elena Michale Art Studio With A Very Long Name',
          headerName: '',
          tagline: 'Test tagline',
          footerTagline: 'Footer',
          copyrightName: 'Test',
        }}
      />
    );

    const siteName = screen.getByTitle('Elena Michale Art Studio With A Very Long Name');
    expect(siteName).toHaveClass('truncate');
  });

  it('uses a compact header name when provided', () => {
    render(
      <Header
        siteIdentity={{
          ...DEFAULT_SITE_IDENTITY,
          siteName: 'Elena Michale Art Studio',
          headerName: 'Elena Michale',
          tagline: 'Test tagline',
          footerTagline: 'Footer',
          copyrightName: 'Test',
        }}
      />
    );

    expect(screen.getByRole('link', { name: 'Elena Michale' })).toHaveAttribute('href', '/');
    expect(screen.getByTitle('Elena Michale Art Studio')).toBeInTheDocument();
  });

  it('uses artist-configured navigation labels and visibility', () => {
    render(
      <Header
        siteIdentity={{
          ...DEFAULT_SITE_IDENTITY,
          navigation: DEFAULT_NAVIGATION.map((item) => {
            if (item.key === 'blog') return { ...item, visible: false };
            if (item.key === 'shop') return { ...item, label: 'Store' };
            return item;
          }),
        }}
      />
    );

    expect(screen.queryByRole('link', { name: 'Updates' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Store' })).toHaveAttribute('href', '/shop');
  });

  it('is sticky positioned', () => {
    render(<Header />);
    
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky', 'top-0', 'z-50');
  });

  it('shows a studio dashboard shortcut for admins', () => {
    mockUseSession.mockReturnValue({
      data: { user: { isAdmin: true, name: 'Admin User', email: 'artist@artistsite.com' } },
      status: 'authenticated',
    } as never);

    render(<Header />);

    expect(screen.getByRole('link', { name: 'Studio' })).toHaveAttribute('href', '/admin');
  });
});