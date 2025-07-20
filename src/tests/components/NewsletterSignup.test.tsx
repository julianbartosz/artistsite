import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsletterSignup } from '@/components/NewsletterSignup';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('NewsletterSignup Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('renders signup form correctly', () => {
    render(<NewsletterSignup />);
    
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    expect(screen.getByText('No spam, unsubscribe at any time.')).toBeInTheDocument();
  });

  it('validates email input', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    
    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    
    // Try to submit empty form
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter your email address')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    
    // Enter invalid email
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('submits form successfully', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Success!' }),
    });
    
    render(<NewsletterSignup />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    
    // Enter valid email and submit
    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);
    
    // Should show loading state
    expect(screen.getByText('Subscribing...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Thank you for subscribing! Check your email for confirmation.')).toBeInTheDocument();
    });
    
    // Email input should be cleared
    expect(emailInput).toHaveValue('');
  });

  it('handles already subscribed error', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Already subscribed' }),
    });
    
    render(<NewsletterSignup />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    
    await user.type(emailInput, 'existing@example.com');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('This email is already subscribed to our newsletter.')).toBeInTheDocument();
    });
  });

  it('handles network errors', async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    render(<NewsletterSignup />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    
    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Network error. Please check your connection and try again.')).toBeInTheDocument();
    });
  });

  it('clears error when user starts typing', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    
    // Trigger an error
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter your email address')).toBeInTheDocument();
    });
    
    // Start typing should clear error
    await user.type(emailInput, 'test');
    
    await waitFor(() => {
      expect(screen.queryByText('Please enter your email address')).not.toBeInTheDocument();
    });
  });

  it('shows subscribe another email option after success', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Success!' }),
    });
    
    render(<NewsletterSignup />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByRole('button', { name: 'Subscribe' });
    
    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Subscribe another email')).toBeInTheDocument();
    });
    
    // Click to reset form
    await user.click(screen.getByText('Subscribe another email'));
    
    expect(screen.getByText('No spam, unsubscribe at any time.')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<NewsletterSignup className="custom-class" />);
    
    const container = screen.getByRole('button', { name: 'Subscribe' }).closest('div');
    expect(container).toHaveClass('custom-class');
  });
});