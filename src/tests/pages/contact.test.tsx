import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactPage from '@/app/contact/page';

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    // Remove boolean-only props like fill that cause DOM warnings
    const { fill, priority, sizes, ...rest } = props;
    return <img src={src} alt={alt} {...rest} />;
  };
});

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage for rate limiting
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Preserve original console.error and suppress expected contact form error noise
const originalConsoleError = console.error;
let consoleErrorSpy: jest.SpyInstance;
beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Contact form error:')) return;
    // @ts-expect-error allow passthrough of variadic args in mock
    originalConsoleError(...args);
  });
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
});

describe('Contact Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Form Rendering', () => {
    it('renders the contact form with all required fields', () => {
      render(<ContactPage />);
      
      expect(screen.getByRole('heading', { name: /get in touch/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/type of inquiry/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('displays contact information and artist details', () => {
      render(<ContactPage />);
      
      expect(screen.getByText(/hello@artistsite.com/i)).toBeInTheDocument();
      expect(screen.getByText(/new york, ny/i)).toBeInTheDocument();
      // Refined matcher to exact handle to avoid matching the email address
      expect(screen.getByText(/^@artistsite$/i)).toBeInTheDocument();
    });

    it('shows response time information', () => {
      render(<ContactPage />);
      
      expect(screen.getByText(/24-48 hours/i)).toBeInTheDocument();
      expect(screen.getByText(/purchase inquiries: same day/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      render(<ContactPage />);
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
        expect(screen.getByText(/message is required/i)).toBeInTheDocument();
      });
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      render(<ContactPage />);
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger onBlur
      
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('validates minimum length requirements', async () => {
      const user = userEvent.setup();
      render(<ContactPage />);
      
      const nameInput = screen.getByLabelText(/name/i);
      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message/i);
      
      await user.type(nameInput, 'A');
      await user.tab();
      await user.type(subjectInput, 'Hi');
      await user.tab();
      await user.type(messageInput, 'Short message');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/subject must be at least 5 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/message must be at least 20 characters/i)).toBeInTheDocument();
      });
    });

    it('clears validation errors when user fixes them', async () => {
      const user = userEvent.setup();
      render(<ContactPage />);
      
      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'A');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
      });
      
      await user.clear(nameInput);
      await user.type(nameInput, 'John Doe');
      
      await waitFor(() => {
        expect(screen.queryByText(/name must be at least 2 characters/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    const validFormData = {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Interest in artwork',
      message: 'I am interested in purchasing one of your paintings. Could you please send me more information about available pieces?',
      inquiryType: 'purchase'
    };

    it('submits form successfully with valid data', async () => {
      const user = userEvent.setup();
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Message sent successfully!' })
      } as Response);

      render(<ContactPage />);
      
      await user.selectOptions(screen.getByLabelText(/type of inquiry/i), 'purchase');
      await user.type(screen.getByLabelText(/name/i), validFormData.name);
      await user.type(screen.getByLabelText(/email/i), validFormData.email);
      await user.type(screen.getByLabelText(/subject/i), validFormData.subject);
      await user.type(screen.getByLabelText(/message/i), validFormData.message);
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/thank you for your message/i)).toBeInTheDocument();
      });
      
      expect(mockFetch).toHaveBeenCalledWith('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: validFormData.name,
          email: validFormData.email.toLowerCase(),
          subject: validFormData.subject,
          message: validFormData.message,
          inquiryType: validFormData.inquiryType
        }),
      });
    });

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup();
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error occurred' })
      } as Response);

      render(<ContactPage />);
      
      await user.selectOptions(screen.getByLabelText(/type of inquiry/i), 'general');
      await user.type(screen.getByLabelText(/name/i), validFormData.name);
      await user.type(screen.getByLabelText(/email/i), validFormData.email);
      await user.type(screen.getByLabelText(/subject/i), validFormData.subject);
      await user.type(screen.getByLabelText(/message/i), validFormData.message);
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/server error occurred/i)).toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ message: 'Success' })
        } as Response), 100))
      );

      render(<ContactPage />);
      
      await user.selectOptions(screen.getByLabelText(/type of inquiry/i), 'general');
      await user.type(screen.getByLabelText(/name/i), validFormData.name);
      await user.type(screen.getByLabelText(/email/i), validFormData.email);
      await user.type(screen.getByLabelText(/subject/i), validFormData.subject);
      await user.type(screen.getByLabelText(/message/i), validFormData.message);
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);
      
      expect(screen.getByText(/sending/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.queryByText(/sending/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('prevents form submission when rate limited', async () => {
      const user = userEvent.setup();
      const now = Date.now();
      const recentRequests = [now - 30000, now - 20000, now - 10000]; // 3 requests in last minute
      localStorageMock.getItem.mockReturnValue(JSON.stringify(recentRequests));

      render(<ContactPage />);
      
      await user.selectOptions(screen.getByLabelText(/type of inquiry/i), 'general');
      await user.type(screen.getByLabelText(/name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/subject/i), 'Test subject');
      await user.type(screen.getByLabelText(/message/i), 'This is a test message that is long enough to pass validation.');
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
      });
    });
  });

  describe('Character Counter', () => {
    it('displays character count for message field', async () => {
      const user = userEvent.setup();
      render(<ContactPage />);
      
      const messageInput = screen.getByLabelText(/message/i);
      expect(screen.getByText(/\(0\/2000 characters\)/i)).toBeInTheDocument();
      
      await user.type(messageInput, 'Hello world');
      expect(screen.getByText(/\(11\/2000 characters\)/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and ARIA attributes', () => {
      render(<ContactPage />);
      
      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const subjectInput = screen.getByLabelText(/subject/i);
      const messageInput = screen.getByLabelText(/message/i);
      
      expect(nameInput).toHaveAttribute('aria-describedby');
      expect(emailInput).toHaveAttribute('aria-describedby');
      expect(subjectInput).toHaveAttribute('aria-describedby');
      expect(messageInput).toHaveAttribute('aria-describedby');
    });

    it('uses role="alert" for status messages', async () => {
      const user = userEvent.setup();
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Success!' })
      } as Response);

      render(<ContactPage />);
      
      await user.selectOptions(screen.getByLabelText(/type of inquiry/i), 'general');
      await user.type(screen.getByLabelText(/name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/subject/i), 'Test subject');
      await user.type(screen.getByLabelText(/message/i), 'This is a test message that is long enough.');
      
      await user.click(screen.getByRole('button', { name: /send message/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});