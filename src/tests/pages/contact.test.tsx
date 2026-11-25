import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSession } from 'next-auth/react';
import ContactPageClient from '@/app/contact/ContactPageClient';
import { DEFAULT_CONTACT_INQUIRY_TYPES, DEFAULT_CONTACT_PAGE } from '@/lib/site-content-shared';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated', update: jest.fn() })),
}));

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

function renderContactPage(props?: { initialSubject?: string; initialInquiryType?: string }) {
  return render(
    <ContactPageClient
      pageContent={DEFAULT_CONTACT_PAGE}
      contactEmail="hello@artistsite.com"
      initialSubject={props?.initialSubject}
      initialInquiryType={props?.initialInquiryType}
    />
  );
}

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    return <img src={src} alt={alt} {...props} />;
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

describe('Contact Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: jest.fn() });
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Form Rendering', () => {
    it('renders the contact form with all required fields', () => {
      renderContactPage();
      
      expect(screen.getByRole('heading', { name: /get in touch/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/type of inquiry/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('prefills subject from shop inquiry links', () => {
      renderContactPage({ initialSubject: 'Inquiry about Urban Twilight' });
      expect(screen.getByLabelText(/subject/i)).toHaveValue('Inquiry about Urban Twilight');
    });

    it('prefills name and email for signed-in users', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 'user-1', name: 'Clara Collector', email: 'clara@example.com', isAdmin: false },
          expires: '2099-01-01',
        },
        status: 'authenticated',
        update: jest.fn(),
      });
      renderContactPage();
      expect(screen.getByLabelText(/^name \*$/i)).toHaveValue('Clara Collector');
      expect(screen.getByLabelText(/^email \*$/i)).toHaveValue('clara@example.com');
    });

    it('displays contact information and artist details', () => {
      renderContactPage();
      
      expect(screen.getByText(/hello@artistsite.com/i)).toBeInTheDocument();
      expect(screen.getByText(/milwaukee, wi/i)).toBeInTheDocument();
      const igLink = screen.getByRole('link', { name: /@michalelenaart/i });
      expect(igLink).toHaveAttribute('href', 'https://www.instagram.com/michalelenaart/');
      expect(igLink).toHaveAttribute('target', '_blank');
      expect(igLink).toHaveAttribute('rel', 'noopener noreferrer');

      const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
      expect(headings.indexOf("Let's Connect")).toBeGreaterThan(-1);
      expect(headings.indexOf('Send a Message')).toBeGreaterThan(headings.indexOf("Let's Connect"));
    });

    it('shows response time information', () => {
      renderContactPage();
      
      expect(screen.getAllByText(/24-48 hours/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/purchase inquiries: same day/i)).toBeInTheDocument();
    });

    it('renders inquiry types from site content', () => {
      render(
        <ContactPageClient
          pageContent={{
            ...DEFAULT_CONTACT_PAGE,
            form: {
              ...DEFAULT_CONTACT_PAGE.form,
              inquiryTypes: DEFAULT_CONTACT_INQUIRY_TYPES.map((item) => {
                if (item.key === 'press') return { ...item, visible: false };
                if (item.key === 'purchase') return { ...item, label: 'Buy a Work' };
                return item;
              }),
            },
          }}
          contactEmail="hello@artistsite.com"
        />
      );

      expect(screen.getByRole('option', { name: 'Buy a Work' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Press & Media' })).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      renderContactPage();
      
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
      renderContactPage();
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger onBlur
      
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('validates minimum length requirements', async () => {
      const user = userEvent.setup();
      renderContactPage();
      
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
      renderContactPage();
      
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
      inquiryType: 'purchase',
      commissionSizeMedium: '',
      commissionTimeline: '',
      commissionTheme: '',
      commissionBudget: '',
    };

    it('submits form successfully with valid data', async () => {
      const user = userEvent.setup();
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Message sent successfully!' })
      } as Response);

      renderContactPage();
      
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
          inquiryType: validFormData.inquiryType,
          commissionSizeMedium: '',
          commissionTimeline: '',
          commissionTheme: '',
          commissionBudget: '',
        }),
      });
    });

    it('requires commission details before sending a commission inquiry', async () => {
      const user = userEvent.setup();
      renderContactPage();

      await user.selectOptions(screen.getByLabelText(/type of inquiry/i), 'commission');
      expect(screen.getByLabelText(/desired size and medium/i)).toBeInTheDocument();

      await user.type(screen.getByLabelText('Name *'), 'Jane Collector');
      await user.type(screen.getByLabelText('Email *'), 'jane@example.com');
      await user.type(screen.getByLabelText('Subject *'), 'Custom portrait commission');
      await user.type(
        screen.getByLabelText(/message/i),
        'I would love a custom piece for our living room based on a family photo.',
      );
      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText(/desired size and medium is required/i)).toBeInTheDocument();
        expect(screen.getByText(/timeline and deadline is required/i)).toBeInTheDocument();
        expect(screen.getByText(/subject matter or theme is required/i)).toBeInTheDocument();
        expect(screen.getByText(/budget range is required/i)).toBeInTheDocument();
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('submits commission inquiries with required details', async () => {
      const user = userEvent.setup();
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Message sent successfully!' }),
      } as Response);

      renderContactPage({ initialInquiryType: 'commission' });

      await user.type(screen.getByLabelText('Name *'), 'Jane Collector');
      await user.type(screen.getByLabelText('Email *'), 'jane@example.com');
      await user.type(screen.getByLabelText('Subject *'), 'Custom portrait commission');
      await user.type(
        screen.getByLabelText(/message/i),
        'I would love a custom piece for our living room based on a family photo.',
      );
      await user.type(screen.getByLabelText(/desired size and medium/i), '30x40 oil on linen');
      await user.type(screen.getByLabelText(/timeline and deadline/i), 'Needed by December');
      await user.type(screen.getByLabelText(/subject matter or theme/i), 'Family portrait, warm tones');
      await user.type(screen.getByLabelText(/budget range/i), '$3,000–$5,000');
      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText(/thank you for your message/i)).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/contact', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Jane Collector',
          email: 'jane@example.com',
          subject: 'Custom portrait commission',
          message: 'I would love a custom piece for our living room based on a family photo.',
          inquiryType: 'commission',
          commissionSizeMedium: '30x40 oil on linen',
          commissionTimeline: 'Needed by December',
          commissionTheme: 'Family portrait, warm tones',
          commissionBudget: '$3,000–$5,000',
        }),
      }));
    });

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup();
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error occurred' })
      } as Response);

      renderContactPage();
      
      await user.selectOptions(screen.getByLabelText(/type of inquiry/i), 'general');
      await user.type(screen.getByLabelText('Name *'), validFormData.name);
      await user.type(screen.getByLabelText('Email *'), validFormData.email);
      await user.type(screen.getByLabelText('Subject *'), validFormData.subject);
      await user.type(screen.getByLabelText(/message/i), validFormData.message);
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('contact-form-error')).toHaveTextContent(/server error occurred/i);
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockImplementationOnce(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ message: 'Success' }),
            } as Response);
          }, 250);
        }),
      );

      renderContactPage();
      
      await user.selectOptions(screen.getByLabelText(/type of inquiry/i), 'general');
      await user.type(screen.getByLabelText('Name *'), validFormData.name);
      await user.type(screen.getByLabelText('Email *'), validFormData.email);
      await user.type(screen.getByLabelText('Subject *'), validFormData.subject);
      await user.type(screen.getByLabelText(/message/i), validFormData.message);
      
      const submitButton = screen.getByRole('button', { name: /send message/i });
      const submitPromise = user.click(submitButton);

      expect(await screen.findByRole('button', { name: /sending/i })).toBeDisabled();

      await submitPromise;
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('prevents form submission when rate limited', async () => {
      const user = userEvent.setup();
      const now = Date.now();
      const recentRequests = [now - 30000, now - 20000, now - 10000]; // 3 requests in last minute
      localStorageMock.getItem.mockReturnValue(JSON.stringify(recentRequests));

      renderContactPage();
      
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
      renderContactPage();
      
      const messageInput = screen.getByLabelText(/message/i);
      expect(screen.getByText(/\(0\/2000 characters\)/i)).toBeInTheDocument();
      
      await user.type(messageInput, 'Hello world');
      expect(screen.getByText(/\(11\/2000 characters\)/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and ARIA attributes', async () => {
      const user = userEvent.setup();
      renderContactPage();

      const nameInput = screen.getByLabelText(/^name \*$/i);
      await user.type(nameInput, 'A');
      await user.tab();

      await waitFor(() => {
        expect(nameInput).toHaveAttribute('aria-describedby');
      });
    });

    it('uses role="alert" for status messages', async () => {
      const user = userEvent.setup();
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Success!' })
      } as Response);

      renderContactPage();
      
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