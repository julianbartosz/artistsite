import { render, screen } from '@testing-library/react';
import { PreviewBanner } from '@/components/PreviewBanner';

// Mock next/router for the exit preview functionality
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('PreviewBanner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders preview banner correctly', () => {
    render(<PreviewBanner />);
    
    expect(screen.getByText(/You are viewing a preview/)).toBeInTheDocument();
    expect(screen.getByText('Exit Preview')).toBeInTheDocument();
  });

  it('has correct styling for visibility', () => {
    render(<PreviewBanner />);
    
    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('bg-yellow-400', 'text-black');
  });

  it('exits preview when button is clicked', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    render(<PreviewBanner />);
    
    const exitButton = screen.getByText('Exit Preview');
    exitButton.click();

    expect(mockFetch).toHaveBeenCalledWith('/api/preview', {
      method: 'POST',
    });
  });
});