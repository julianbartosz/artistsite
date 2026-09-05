import { render, screen } from '@testing-library/react';
import { PreviewBanner } from '@/components/PreviewBanner';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
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
