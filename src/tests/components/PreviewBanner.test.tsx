import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewBanner } from '@ui/components/layout/PreviewBanner';

// Provide a full router mock including refresh to avoid overriding global mock with missing methods
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: mockRefresh,
  }),
}));

describe('PreviewBanner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders preview banner correctly', () => {
    render(<PreviewBanner />);
    expect(screen.getByText(/preview mode active/i)).toBeInTheDocument();
    expect(screen.getByText(/you are viewing draft content/i)).toBeInTheDocument();
    expect(screen.getByText('Exit Preview')).toBeInTheDocument();
  });

  it('has correct styling and landmark role', () => {
    render(<PreviewBanner />);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('bg-yellow-400', 'text-black');
  });

  it('exits preview when button is clicked and refreshes the router', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error: overriding global fetch for this test
    global.fetch = mockFetch;

    render(<PreviewBanner />);

    fireEvent.click(screen.getByText('Exit Preview'));

    expect(mockFetch).toHaveBeenCalledWith('/api/preview', {
      method: 'DELETE',
    });

    // wait for microtask queue
    await Promise.resolve();
    expect(mockRefresh).toHaveBeenCalled();
  });
});