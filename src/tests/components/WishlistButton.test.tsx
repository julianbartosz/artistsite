import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { WishlistButton, evictWishlistCacheItem } from '@/components/WishlistButton';
import CollectorFeedLink from '@/components/CollectorFeedLink';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated', update: jest.fn() })),
}));

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

describe('WishlistButton visibility and sync', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ['unauthenticated guest', { data: null, status: 'unauthenticated' as const }],
    ['loading session', { data: null, status: 'loading' as const }],
    [
      'signed-in admin',
      {
        data: { user: { id: 'admin-1', email: 'artist@example.com', isAdmin: true }, expires: '2099-01-01' },
        status: 'authenticated' as const,
      },
    ],
  ])('does not render heart icon or fetch wishlist for %s', (_label, sessionValue) => {
    mockUseSession.mockReturnValue({ ...sessionValue, update: jest.fn() });

    const { container } = render(<WishlistButton productId="prod-1" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('wishlist-prod-1')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renders and toggles wishlist for signed-in non-admin collectors and honors cache eviction', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'collector-1', email: 'collector@example.com', isAdmin: false }, expires: '2099-01-01' },
      status: 'authenticated',
      update: jest.fn(),
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, items: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    render(<WishlistButton productId="prod-2" />);

    const button = await screen.findByTestId('wishlist-prod-2');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    evictWishlistCacheItem('prod-2');

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('CollectorFeedLink', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('stays collapsed by default without fetching or exposing raw token URLs, and copies on demand', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ feedUrl: 'https://michalelena.art/rss-collector.xml?token=secret-jwt-token' }),
    });

    const { container } = render(<CollectorFeedLink />);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('rss-collector.xml');
    expect(container.textContent).not.toContain('secret-jwt-token');

    fireEvent.click(screen.getByText(/subscribe in an rss reader/i));
    fireEvent.click(screen.getByRole('button', { name: /copy private rss link/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://michalelena.art/rss-collector.xml?token=secret-jwt-token');
      expect(screen.getByRole('button', { name: /link copied/i })).toBeInTheDocument();
    });
    expect(container.textContent).not.toContain('secret-jwt-token');
  });
});
