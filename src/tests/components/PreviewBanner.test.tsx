import { act, render, screen } from '@testing-library/react';
import { PreviewBanner } from '@/components/PreviewBanner';
import CmsPreviewBanner from '@/components/admin/CmsPreviewBanner';

const mockRefresh = jest.fn();
const mockPathname = jest.fn(() => '/');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
  usePathname: () => mockPathname(),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { isAdmin: true } },
    status: 'authenticated',
  }),
}));

describe('PreviewBanner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders preview banner correctly', () => {
    render(<PreviewBanner />);

    expect(screen.getByText(/Preview Mode Active/)).toBeInTheDocument();
    expect(screen.getByText('Exit Preview')).toBeInTheDocument();
  });

  it('has correct styling for visibility', () => {
    render(<PreviewBanner />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveClass('bg-yellow-400', 'text-black');
  });

  it('exits preview when button is clicked', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    render(<PreviewBanner />);

    screen.getByText('Exit Preview').click();

    expect(mockFetch).toHaveBeenCalledWith('/api/preview', {
      method: 'DELETE',
    });
  });
});

describe('CmsPreviewBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/');
  });

  it('offers return to editor and exit preview', () => {
    render(<CmsPreviewBanner />);

    expect(screen.getByRole('link', { name: 'Return to editor' })).toHaveAttribute(
      'href',
      '/admin?tab=pages',
    );
    expect(screen.getByRole('button', { name: 'Exit preview' })).toBeInTheDocument();
  });

  it('stays hidden inside Studio so admin chrome is not cluttered', () => {
    mockPathname.mockReturnValue('/admin');
    const { container } = render(<CmsPreviewBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('clears cms preview cookie state when exiting', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    render(<CmsPreviewBanner />);
    await act(async () => {
      screen.getByRole('button', { name: 'Exit preview' }).click();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/site-content/preview', {
      method: 'DELETE',
      credentials: 'include',
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
