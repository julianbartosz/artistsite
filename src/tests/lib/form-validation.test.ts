import { 
  validateEmail, 
  validateContactForm, 
  sanitizeFormData,
  formatCommissionInquiryDetails,
  isRateLimited,
  type ContactFormData 
} from '@/lib/form-validation';
import {
  artworkPayloadSchema,
  blogPostPayloadSchema,
  normalizeAudienceEmails,
  parsePostMedia,
  productPayloadSchema,
  sanitizeArtworkPayload,
} from '@/lib/admin-content';
import { viewerCanAccessPost } from '@/lib/markdown';
import { buildCatalogPriceRanges } from '@/lib/search-params';
import { buildLaunchReadinessItems } from '@/lib/setup-readiness';
import {
  canonicalCategoryStem,
  findSimilarCategoryMatch,
  homeHeroImagePositionClass,
  portfolioPageSchema,
  SITE_CONTENT_DEFAULTS,
} from '@/lib/site-content-shared';
import React from 'react';
import { markdownToHtml } from '@/lib/markdown-to-html';
import { htmlHasVisibleText } from '@/lib/content-sanitize';
import { render, screen } from '@testing-library/react';
import { MDXContent } from '@/components/MDXContent';
import {
  AUTOMATION_EMAIL_CATALOG,
  AUTOMATION_EMAIL_IDS,
  applyMergeFields,
  buildDefaultAutomationDocument,
  newsletterContentIssues,
  newsletterDocumentFromContent,
  newsletterMergeValues,
  newsletterSendIssues,
  personalizeNewsletter,
  renderNewsletter,
  type NewsletterBlock,
  type NewsletterDocument,
} from '@/lib/newsletter';
import {
  createCollectorProfileToken,
  createUnsubscribeToken,
  verifyCollectorProfileToken,
  verifyUnsubscribeToken,
} from '@/lib/newsletter-subscribers';
import { extractEmailAddress, isResendSandboxSender } from '@/lib/email-shell';

// Mock localStorage for rate limiting tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Form Validation Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('validateEmail', () => {
    it('validates correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.org')).toBe(true);
      expect(validateEmail('user_name@example-domain.com')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test.example.com')).toBe(false);
      expect(validateEmail('test@example')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('test..test@example.com')).toBe(false);
    });
  });

  describe('validateContactForm', () => {
    const validFormData: ContactFormData = {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Test Subject',
      message: 'This is a test message that is long enough to pass validation requirements.',
      inquiryType: 'general',
      commissionSizeMedium: '',
      commissionTimeline: '',
      commissionTheme: '',
      commissionBudget: '',
    };

    const validCommissionFormData: ContactFormData = {
      ...validFormData,
      inquiryType: 'commission',
      commissionSizeMedium: '24x36 oil on canvas',
      commissionTimeline: 'Needed by June',
      commissionTheme: 'Abstract city nightscape',
      commissionBudget: '$2,000–$4,000',
    };

    it('returns no errors for valid form data', () => {
      const errors = validateContactForm(validFormData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    describe('name validation', () => {
      it('requires name to be present', () => {
        const errors = validateContactForm({ ...validFormData, name: '' });
        expect(errors.name).toBe('Name is required');
      });

      it('requires name to be at least 2 characters', () => {
        const errors = validateContactForm({ ...validFormData, name: 'A' });
        expect(errors.name).toBe('Name must be at least 2 characters');
      });

      it('limits name to 100 characters', () => {
        const longName = 'A'.repeat(101);
        const errors = validateContactForm({ ...validFormData, name: longName });
        expect(errors.name).toBe('Name must be less than 100 characters');
      });

      it('trims whitespace when validating', () => {
        const errors = validateContactForm({ ...validFormData, name: '   ' });
        expect(errors.name).toBe('Name is required');
      });
    });

    describe('email validation', () => {
      it('requires email to be present', () => {
        const errors = validateContactForm({ ...validFormData, email: '' });
        expect(errors.email).toBe('Email is required');
      });

      it('validates email format', () => {
        const errors = validateContactForm({ ...validFormData, email: 'invalid-email' });
        expect(errors.email).toBe('Please enter a valid email address');
      });

      it('trims whitespace when validating', () => {
        const errors = validateContactForm({ ...validFormData, email: '   ' });
        expect(errors.email).toBe('Email is required');
      });
    });

    describe('subject validation', () => {
      it('requires subject to be present', () => {
        const errors = validateContactForm({ ...validFormData, subject: '' });
        expect(errors.subject).toBe('Subject is required');
      });

      it('requires subject to be at least 5 characters', () => {
        const errors = validateContactForm({ ...validFormData, subject: 'Hi' });
        expect(errors.subject).toBe('Subject must be at least 5 characters');
      });

      it('limits subject to 200 characters', () => {
        const longSubject = 'A'.repeat(201);
        const errors = validateContactForm({ ...validFormData, subject: longSubject });
        expect(errors.subject).toBe('Subject must be less than 200 characters');
      });
    });

    describe('message validation', () => {
      it('requires message to be present', () => {
        const errors = validateContactForm({ ...validFormData, message: '' });
        expect(errors.message).toBe('Message is required');
      });

      it('requires message to be at least 20 characters', () => {
        const errors = validateContactForm({ ...validFormData, message: 'Short message' });
        expect(errors.message).toBe('Message must be at least 20 characters');
      });

      it('limits message to 2000 characters', () => {
        const longMessage = 'A'.repeat(2001);
        const errors = validateContactForm({ ...validFormData, message: longMessage });
        expect(errors.message).toBe('Message must be less than 2000 characters');
      });
    });

    describe('inquiry type validation', () => {
      it('validates inquiry type against allowed values', () => {
        const errors = validateContactForm({ ...validFormData, inquiryType: 'invalid' });
        expect(errors.inquiryType).toBe('Please select a valid inquiry type');
      });

      it('accepts valid inquiry types', () => {
        const validTypes = ['general', 'purchase', 'commission', 'press', 'exhibition'] as const;
        
        validTypes.forEach((type) => {
          const payload = type === 'commission' ? validCommissionFormData : { ...validFormData, inquiryType: type };
          const errors = validateContactForm(payload);
          expect(errors.inquiryType).toBeUndefined();
        });
      });
    });

    describe('commission inquiry details', () => {
      it('accepts a complete commission request', () => {
        expect(Object.keys(validateContactForm(validCommissionFormData))).toHaveLength(0);
      });

      it.each([
        ['commissionSizeMedium', 'Desired size and medium is required for commission requests'],
        ['commissionTimeline', 'Timeline and deadline is required for commission requests'],
        ['commissionTheme', 'Subject matter or theme is required for commission requests'],
        ['commissionBudget', 'Budget range is required for commission requests'],
      ] as const)('requires %s for commissions', (field, message) => {
        const errors = validateContactForm({ ...validCommissionFormData, [field]: '  ' });
        expect(errors[field]).toBe(message);
      });

      it('does not require commission fields for non-commission inquiries', () => {
        const errors = validateContactForm(validFormData);
        expect(errors.commissionSizeMedium).toBeUndefined();
        expect(errors.commissionTimeline).toBeUndefined();
        expect(errors.commissionTheme).toBeUndefined();
        expect(errors.commissionBudget).toBeUndefined();
      });
    });

    it('returns multiple errors when multiple fields are invalid', () => {
      const invalidData: ContactFormData = {
        name: '',
        email: 'invalid-email',
        subject: 'Hi',
        message: 'Short',
        inquiryType: 'invalid',
        commissionSizeMedium: '',
        commissionTimeline: '',
        commissionTheme: '',
        commissionBudget: '',
      };

      const errors = validateContactForm(invalidData);
      
      expect(errors.name).toBeDefined();
      expect(errors.email).toBeDefined();
      expect(errors.subject).toBeDefined();
      expect(errors.message).toBeDefined();
      expect(errors.inquiryType).toBeDefined();
      expect(Object.keys(errors)).toHaveLength(5);
    });
  });

  describe('sanitizeFormData', () => {
    it('trims whitespace from all fields', () => {
      const dirtyData: ContactFormData = {
        name: '  John Doe  ',
        email: '  john@EXAMPLE.com  ',
        subject: '  Test Subject  ',
        message: '  This is a test message  ',
        inquiryType: 'general',
        commissionSizeMedium: '',
        commissionTimeline: '',
        commissionTheme: '',
        commissionBudget: '',
      };

      const sanitized = sanitizeFormData(dirtyData);
      
      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.email).toBe('john@example.com');
      expect(sanitized.subject).toBe('Test Subject');
      expect(sanitized.message).toBe('This is a test message');
      expect(sanitized.inquiryType).toBe('general');
    });

    it('converts email to lowercase', () => {
      const data: ContactFormData = {
        name: 'John Doe',
        email: 'JOHN@EXAMPLE.COM',
        subject: 'Test Subject',
        message: 'This is a test message',
        inquiryType: 'general',
        commissionSizeMedium: '',
        commissionTimeline: '',
        commissionTheme: '',
        commissionBudget: '',
      };

      const sanitized = sanitizeFormData(data);
      expect(sanitized.email).toBe('john@example.com');
    });

    it('preserves inquiry type exactly and keeps commission details only for commissions', () => {
      const data: ContactFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message',
        inquiryType: 'commission',
        commissionSizeMedium: '  30x40 oil  ',
        commissionTimeline: '  June  ',
        commissionTheme: '  Portrait  ',
        commissionBudget: '  $3k  ',
      };

      const sanitized = sanitizeFormData(data);
      expect(sanitized.inquiryType).toBe('commission');
      expect(sanitized.commissionSizeMedium).toBe('30x40 oil');
      expect(formatCommissionInquiryDetails(sanitized)).toContain('Budget range: $3k');

      const general = sanitizeFormData({ ...data, inquiryType: 'general' });
      expect(general.commissionSizeMedium).toBe('');
      expect(formatCommissionInquiryDetails(general)).toBeNull();
    });
  });

  describe('isRateLimited', () => {
    beforeEach(() => {
      // Reset Date.now mock
      jest.spyOn(Date, 'now').mockRestore();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('allows requests when no previous requests exist', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const result = isRateLimited('test@example.com');
      expect(result).toBe(false);
    });

    it('allows requests when under the rate limit', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const previousRequests = [now - 30000]; // 1 request 30 seconds ago
      localStorageMock.getItem.mockReturnValue(JSON.stringify(previousRequests));
      
      const result = isRateLimited('test@example.com', 60000, 3);
      expect(result).toBe(false);
    });

    it('blocks requests when at the rate limit', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const previousRequests = [now - 30000, now - 20000, now - 10000]; // 3 recent requests
      localStorageMock.getItem.mockReturnValue(JSON.stringify(previousRequests));
      
      const result = isRateLimited('test@example.com', 60000, 3);
      expect(result).toBe(true);
    });

    it('ignores requests outside the time window', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const previousRequests = [
        now - 120000, // 2 minutes ago (outside window)
        now - 90000,  // 1.5 minutes ago (outside window)
        now - 30000   // 30 seconds ago (within window)
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(previousRequests));
      
      const result = isRateLimited('test@example.com', 60000, 3);
      expect(result).toBe(false);
    });

    it('updates localStorage with current request timestamp', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify([now - 30000]));
      
      isRateLimited('test@example.com', 60000, 3);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'contact_rate_limit_test@example.com',
        JSON.stringify([now - 30000, now])
      );
    });

    it('uses custom window and max request parameters', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const previousRequests = [now - 10000]; // 1 request 10 seconds ago
      localStorageMock.getItem.mockReturnValue(JSON.stringify(previousRequests));
      
      // Custom parameters: 15 second window, max 1 request
      const result = isRateLimited('test@example.com', 15000, 1);
      expect(result).toBe(true);
    });

    it('handles malformed localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');
      
      const result = isRateLimited('test@example.com');
      expect(result).toBe(false);
    });

    it('works when localStorage is not available', () => {
      // Temporarily remove localStorage
      const originalLocalStorage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        value: undefined
      });
      
      const result = isRateLimited('test@example.com');
      expect(result).toBe(false);
      
      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage
      });
    });
  });
});

describe('update post payload', () => {
  it.each([
    { input: [{ url: '/uploads/images/a.jpg', type: 'image' }], expectedType: 'image' },
    { input: [{ url: 'https://cdn.example.com/clip.mp4', type: 'video' }], expectedType: 'video' },
    { input: ['/uploads/images/legacy.jpg'], expectedType: 'image' },
  ])('parses $expectedType media', ({ input, expectedType }) => {
    const parsed = parsePostMedia(input);
    expect(parsed[0].type).toBe(expectedType);
    expect(parsed[0].url).toBeTruthy();
  });

  it('rejects javascript and protocol-relative media URLs', () => {
    expect(parsePostMedia(['javascript:alert(1)', '//evil.example', { url: '/ok.jpg' }])).toEqual([
      { url: '/ok.jpg', type: 'image' },
    ]);
  });

  it('allows a studio update with media and no journal title', () => {
    const parsed = blogPostPayloadSchema.parse({
      format: 'short',
      excerpt: 'Oil study after rain',
      media: [{ url: '/uploads/images/rain.jpg', type: 'image' }],
      isDraft: false,
    });
    expect(parsed.format).toBe('short');
    expect(parsed.media).toHaveLength(1);
  });

  it('rejects a published studio update with no media or caption', () => {
    expect(() => blogPostPayloadSchema.parse({
      format: 'short',
      isDraft: false,
    })).toThrow();
  });

  it('normalizes collector emails', () => {
    expect(normalizeAudienceEmails('Buyer@Example.com, buyer@example.com, not-an-email')).toEqual([
      'buyer@example.com',
    ]);
  });

  it('rejects a published private update without collector emails', () => {
    expect(() => blogPostPayloadSchema.parse({
      format: 'short',
      excerpt: 'Private studio note',
      isDraft: false,
      visibility: 'private',
      audienceEmails: [],
    })).toThrow();
  });

  it('treats a blank slug as omitted so studio posts can auto-generate one', () => {
    const parsed = blogPostPayloadSchema.parse({
      format: 'short',
      slug: '',
      excerpt: 'Morning glaze test',
      media: [{ url: '/uploads/images/glaze.jpg', type: 'image' }],
      isDraft: false,
    });
    expect(parsed.slug).toBeUndefined();
  });
});

describe('update access control', () => {
  it('allows admins to preview drafts without granting private audience access', () => {
    expect(viewerCanAccessPost(
      { visibility: 'private', isDraft: true },
      { id: 'admin', email: 'artist@artistsite.com', isAdmin: true },
      { includeDrafts: true },
    )).toBe(true);

    expect(viewerCanAccessPost(
      { visibility: 'private', isDraft: false },
      { id: 'admin', email: 'artist@artistsite.com', isAdmin: true },
      { audienceEmails: ['buyer@example.com'] },
    )).toBe(true);
  });

  it('blocks private updates for viewers not on the whitelist', () => {
    expect(viewerCanAccessPost(
      { visibility: 'private', isDraft: false },
      { id: 'other', email: 'stranger@example.com' },
      { audienceEmails: ['buyer@example.com'] },
    )).toBe(false);

    expect(viewerCanAccessPost(
      { visibility: 'private', isDraft: false },
      { id: 'buyer', email: 'buyer@example.com' },
      { audienceEmails: ['buyer@example.com'] },
    )).toBe(true);
  });
});

describe('launch readiness checklist', () => {
  it('does not deep-link database issues to automation secrets', () => {
    const items = buildLaunchReadinessItems({ databaseHealthy: false });
    const database = items.find((item) => item.key === 'database');
    expect(database?.complete).toBe(false);
    expect(database?.settingKey).toBeUndefined();
    expect(database?.helpText).toMatch(/DATABASE_URL/i);
  });

  it.each([
    {
      name: 'incomplete when only delivery mode is set',
      settings: new Map([['EMAIL_DELIVERY_MODE', 'configured' as const]]),
      complete: false,
    },
    {
      name: 'complete with contact email and delivery mode',
      settings: new Map([
        ['CONTACT_EMAIL', 'configured' as const],
        ['EMAIL_DELIVERY_MODE', 'configured' as const],
      ]),
      complete: true,
    },
    {
      name: 'complete with contact email and SMTP pair',
      settings: new Map([
        ['CONTACT_EMAIL', 'configured' as const],
        ['SMTP_FROM', 'configured' as const],
        ['SMTP_USER', 'configured' as const],
      ]),
      complete: true,
    },
    {
      name: 'incomplete when SMTP_FROM uses Resend sandbox domain in smtp mode',
      settings: new Map([
        ['CONTACT_EMAIL', 'configured' as const],
        ['EMAIL_DELIVERY_MODE', 'configured' as const],
        ['SMTP_FROM', 'configured' as const],
        ['SMTP_USER', 'configured' as const],
      ]),
      settingValues: new Map([
        ['EMAIL_DELIVERY_MODE', 'smtp'],
        ['SMTP_FROM', 'Michal Elena <onboarding@resend.dev>'],
      ]),
      complete: false,
    },
    {
      name: 'incomplete when SMTP mode is missing SMTP_HOST or SMTP_PASSWORD',
      settings: new Map([
        ['CONTACT_EMAIL', 'configured' as const],
        ['EMAIL_DELIVERY_MODE', 'configured' as const],
        ['SMTP_FROM', 'configured' as const],
        ['SMTP_USER', 'configured' as const],
      ]),
      settingValues: new Map([
        ['EMAIL_DELIVERY_MODE', 'smtp'],
        ['SMTP_FROM', 'Michal Elena <hello@michalelena.art>'],
      ]),
      complete: false,
    },
    {
      name: 'complete when SMTP mode has host, user, password, and verified From',
      settings: new Map([
        ['CONTACT_EMAIL', 'configured' as const],
        ['EMAIL_DELIVERY_MODE', 'configured' as const],
        ['SMTP_HOST', 'configured' as const],
        ['SMTP_USER', 'configured' as const],
        ['SMTP_PASSWORD', 'configured' as const],
        ['SMTP_FROM', 'configured' as const],
      ]),
      settingValues: new Map([
        ['EMAIL_DELIVERY_MODE', 'smtp'],
        ['SMTP_FROM', 'Michal Elena <hello@michalelena.art>'],
      ]),
      complete: true,
    },
    {
      name: 'complete when SMTP_FROM uses Resend sandbox domain in log mode',
      settings: new Map([
        ['CONTACT_EMAIL', 'configured' as const],
        ['EMAIL_DELIVERY_MODE', 'configured' as const],
      ]),
      settingValues: new Map([
        ['EMAIL_DELIVERY_MODE', 'log'],
        ['SMTP_FROM', 'Michal Elena <onboarding@resend.dev>'],
      ]),
      complete: true,
    },
  ])('marks email readiness $name', ({ settings, settingValues, complete }) => {
    const items = buildLaunchReadinessItems({ settings, settingValues });
    expect(items.find((item) => item.key === 'email')?.complete).toBe(complete);
  });

  it.each([
    ['onboarding@resend.dev', 'onboarding@resend.dev', true],
    ['Michal Elena <onboarding@resend.dev>', 'onboarding@resend.dev', true],
    ['Michal Elena <hello@michalelena.art>', 'hello@michalelena.art', false],
    ['', '', false],
  ])('extractEmailAddress & isResendSandboxSender(%p)', (raw, address, sandbox) => {
    expect(extractEmailAddress(raw)).toBe(address);
    expect(isResendSandboxSender(raw)).toBe(sandbox);
  });

  it('signs and verifies collector profile cookies without accepting unsubscribe tokens', () => {
    const prev = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = 'test-signing-secret-for-profile-cookies';
    try {
      const token = createCollectorProfileToken('prof_123');
      expect(token).toBeTruthy();
      expect(verifyCollectorProfileToken(token)).toBe('prof_123');
      expect(verifyCollectorProfileToken(`${token}tampered`)).toBeNull();
      expect(verifyCollectorProfileToken(createUnsubscribeToken('a@example.com'))).toBeNull();
    } finally {
      process.env.NEXTAUTH_SECRET = prev;
    }
  });

  it('marks payments ready for manual purchase requests or when both Stripe keys are configured', () => {
    const partial = buildLaunchReadinessItems({
      settings: new Map([['STRIPE_SECRET_KEY', 'configured']]),
    });
    const both = buildLaunchReadinessItems({
      settings: new Map([
        ['STRIPE_SECRET_KEY', 'configured'],
        ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'configured'],
      ]),
    });
    const manual = buildLaunchReadinessItems({
      settings: new Map([['CHECKOUT_MODE', 'configured']]),
      settingValues: new Map([['CHECKOUT_MODE', 'manual']]),
    });
    expect(partial.find((item) => item.key === 'payments')?.complete).toBe(false);
    expect(both.find((item) => item.key === 'payments')?.complete).toBe(true);
    expect(manual.find((item) => item.key === 'payments')?.complete).toBe(true);
  });

  it('marks updates optional when hidden in navigation or disabled on home', () => {
    const defaultItems = buildLaunchReadinessItems({});
    expect(defaultItems.find((item) => item.key === 'blog')?.optional).toBe(false);

    const hiddenItems = buildLaunchReadinessItems({
      content: {
        ...SITE_CONTENT_DEFAULTS,
        home: {
          ...SITE_CONTENT_DEFAULTS.home,
          blog: { ...SITE_CONTENT_DEFAULTS.home.blog, showSection: false },
        },
      },
    });
    expect(hiddenItems.find((item) => item.key === 'blog')?.optional).toBe(true);
  });
});

describe('dynamic catalog price ranges', () => {
  it.each([
    { name: 'empty or single price', prices: [25], expectedLabels: [] },
    { name: 'identical prices', prices: [20, 20, 20], expectedLabels: [] },
    {
      name: 'small prints & postcards ($5-$30)',
      prices: [5, 5, 20, 22, 30],
      expectedLabels: ['Under $10', '$10 – $25', '$25 – $50'],
    },
    {
      name: 'mid-range catalog ($20-$180)',
      prices: [20, 45, 120, 180],
      expectedLabels: ['Under $25', '$25 – $75', '$75 – $150', 'Over $150'],
    },
    {
      name: 'fine art gallery ($350-$6000)',
      prices: [350, 900, 1800, 6000],
      expectedLabels: ['Under $500', '$500 – $1,000', '$1,000 – $2,500', 'Over $5,000'],
    },
  ])('builds catalog-scaled brackets for $name', ({ prices, expectedLabels }) => {
    expect(buildCatalogPriceRanges(prices).map((range) => range.label)).toEqual(expectedLabels);
  });
});

describe('portfolio / blog rich content ingress', () => {
  it.each([
    {
      name: 'inline emphasis and strong',
      markdown: '*Series note*\n\n**Midnight Reflections** at night.',
      expectHtml: [/<em>Series note<\/em>/, /<strong>Midnight Reflections<\/strong>/],
      forbid: ['*', '**'],
    },
    {
      name: 'headings and gfm lists',
      markdown: '## Process\n\n- **Texture medium** on canvas\n- Glazing layers',
      expectHtml: [/<h2>Process<\/h2>/, /<ul>/, /<li><strong>Texture medium<\/strong> on canvas<\/li>/],
      forbid: ['- **', '## '],
    },
    {
      name: 'empty markdown',
      markdown: '   ',
      expectHtml: [/^<p><\/p>$/],
      forbid: [],
    },
  ])('markdownToHtml handles $name', ({ markdown, expectHtml, forbid }) => {
    const html = markdownToHtml(markdown);
    for (const pattern of expectHtml) {
      expect(html).toMatch(pattern);
    }
    for (const token of forbid) {
      expect(html.includes(token)).toBe(false);
    }
  });

  it('MDXContent skips empty shells and renders sanitized HTML', () => {
    const { container: empty } = render(React.createElement(MDXContent, { code: '<p></p>' }));
    expect(empty).toBeEmptyDOMElement();

    render(React.createElement(MDXContent, {
      code: '<h2>Artist Statement</h2><p><strong>Bold</strong> body</p>',
    }));
    expect(screen.getByRole('heading', { name: 'Artist Statement' })).toBeInTheDocument();
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(htmlHasVisibleText('<p>Visible</p>')).toBe(true);
    expect(htmlHasVisibleText('<p></p>')).toBe(false);
  });
});

describe('newsletter composition', () => {
  const context = { siteName: 'Ana Studio', siteUrl: 'https://ana.art', primaryColor: '#1f2937', footerAddress: 'PO Box 1, Austin TX' };
  const doc = (blocks: NewsletterBlock[], subject = 'Hi {{first_name}}'): NewsletterDocument => ({ subject, preheader: '', fromName: '', blocks });

  it.each([
    { input: 'Hi {{first_name}}', values: { first_name: 'Ana' }, mode: 'text', expected: 'Hi Ana' },
    { input: 'Hi {{ first_name }}', values: {}, mode: 'text', expected: 'Hi there' },
    { input: 'Hi {{first_name|friend}}', values: { first_name: '  ' }, mode: 'text', expected: 'Hi friend' },
    { input: '<p>{{first_name}}</p>', values: { first_name: '<b>Al</b>' }, mode: 'html', expected: '<p>&lt;b&gt;Al&lt;/b&gt;</p>' },
    { input: '{{shoe_size}} {{email', values: { email: 'a@b.co' }, mode: 'text', expected: '{{shoe_size}} {{email' },
  ] as const)('applyMergeFields renders $input', ({ input, values, mode, expected }) => {
    expect(applyMergeFields(input, values, mode)).toBe(expected);
  });

  it.each([
    { name: 'site link', html: '<p><a href="/shop">Shop</a></p>', html_has: 'href="https://ana.art/shop"', text_has: 'Shop (https://ana.art/shop)' },
    { name: 'inline image', html: '<p><img src="/uploads/a.jpg" alt="A"></p>', html_has: 'src="https://ana.art/uploads/a.jpg"', text_has: '' },
    { name: 'absolute link', html: '<p><a href="https://x.com/a?b=1&amp;c=2">X</a></p>', html_has: 'href="https://x.com/a?b=1&amp;c=2"', text_has: 'X (https://x.com/a?b=1&c=2)' },
    { name: 'merge-field link', html: '<p><a href="{{site_url}}/about">About</a></p>', html_has: 'href="{{site_url}}/about"', text_has: '' },
  ])('renderNewsletter resolves $name in text blocks', ({ html, html_has, text_has }) => {
    const rendered = renderNewsletter(doc([{ id: 't', type: 'text', html }]), context);
    expect(rendered.html).toContain(html_has);
    if (text_has) expect(rendered.text).toContain(text_has);
    expect(rendered.html).toContain('href="{{unsubscribe_url}}"');
    expect(rendered.html).toContain('PO Box 1, Austin TX');
  });

  it.each([
    { name: 'ready', blocks: [{ id: 'a', type: 'text', html: '<p>Hello</p>' }], subject: 'News', siteUrl: 'https://ana.art', keys: [] },
    { name: 'empty', blocks: [{ id: 'a', type: 'divider' }], subject: '', siteUrl: 'https://ana.art', keys: ['subject', 'content'] },
    { name: 'unknown field', blocks: [{ id: 'a', type: 'text', html: '<p>{{nickname}}</p>' }], subject: 'News', siteUrl: '', keys: ['field-{{nickname}}'] },
    { name: 'site path without site URL', blocks: [{ id: 'a', type: 'button', label: 'Go', href: '/shop' }], subject: 'News', siteUrl: '', keys: ['button-a'] },
    { name: 'unsafe text link', blocks: [{ id: 'a', type: 'text', html: '<p><a href="ftp://x">x</a></p>' }], subject: 'News', siteUrl: 'https://ana.art', keys: ['text-link-a'] },
    { name: 'unpicked artwork', blocks: [{ id: 'a', type: 'product', productId: '', title: '', imageUrl: '', priceLabel: '', href: '', ctaLabel: '' }, { id: 'b', type: 'text', html: '<p>Hi</p>' }], subject: 'News', siteUrl: 'https://ana.art', keys: ['product-a'] },
  ] as Array<{ name: string; blocks: NewsletterBlock[]; subject: string; siteUrl: string; keys: string[] }>)('newsletterContentIssues: $name', ({ blocks, subject, siteUrl, keys }) => {
    expect(newsletterContentIssues(doc(blocks, subject), { siteUrl }).map((issue) => issue.key)).toEqual(keys);
  });

  it('newsletterSendIssues also requires address, real delivery, verified sender, and an audience', () => {
    const ready = doc([{ id: 'a', type: 'text', html: '<p>Hello</p>' }], 'News');
    expect(newsletterSendIssues(ready, { ...context, subscriberCount: 3, deliveryMode: 'smtp', fromAddress: 'hello@ana.art' })).toEqual([]);
    expect(newsletterSendIssues(ready, { ...context, subscriberCount: 3, deliveryMode: 'smtp', fromAddress: 'Ana <onboarding@resend.dev>' }).map((issue) => issue.key))
      .toEqual(['sandbox-sender']);
    expect(newsletterSendIssues(ready, { ...context, footerAddress: ' ', subscriberCount: 0, deliveryMode: 'log' }).map((issue) => issue.key))
      .toEqual(['address', 'delivery', 'audience']);
  });

  it.each(AUTOMATION_EMAIL_CATALOG.map((def) => ({
    id: def.id,
    audienceKind: def.audienceKind,
    promoCode: def.id === AUTOMATION_EMAIL_IDS.cartRecovery ? 'SAVE10' : undefined,
  })))('default automation document $id validates cleanly and renders personalized email', ({ id, audienceKind, promoCode }) => {
    const defaultDoc = buildDefaultAutomationDocument(id, { siteName: context.siteName, promoCode });
    expect(newsletterContentIssues(defaultDoc, { siteUrl: context.siteUrl }, { audienceKind })).toEqual([]);
    const rendered = personalizeNewsletter(
      renderNewsletter(defaultDoc, {
        ...context,
        ...(audienceKind === 'checkout'
          ? { footerReason: 'You began checking out at Ana Studio.', includeUnsubscribe: false }
          : {}),
      }),
      newsletterMergeValues(
        { email: 'ada@example.com', firstName: 'Ada' },
        context,
        'https://ana.art/unsubscribe',
        audienceKind === 'checkout' ? { checkout_url: 'https://ana.art/checkout', promo_code: 'SAVE10' } : undefined,
      ),
    );
    expect(rendered.html).toContain('Hi Ada,');
    if (audienceKind === 'checkout') {
      expect(rendered.html).toContain('href="https://ana.art/checkout"');
      expect(rendered.html).toContain('SAVE10');
      expect(rendered.html).not.toContain('Unsubscribe');
    } else {
      expect(rendered.html).toContain('https://ana.art/unsubscribe');
    }
  });

  it('rejects checkout-only merge fields in regular newsletters while allowing them in cart recovery', () => {
    const checkoutDoc = doc([
      { id: 't', type: 'text', html: '<p>Use {{promo_code}}</p>' },
      { id: 'b', type: 'button', label: 'Return', href: '{{checkout_url}}' },
    ], 'Cart waiting');
    expect(newsletterContentIssues(checkoutDoc, { siteUrl: context.siteUrl }, { audienceKind: 'checkout' })).toEqual([]);
    expect(newsletterContentIssues(checkoutDoc, { siteUrl: context.siteUrl }).map((issue) => issue.key))
      .toEqual(['field-{{promo_code}}', 'field-{{checkout_url}}']);
  });

  it('newsletterDocumentFromContent upgrades legacy campaigns to one text block', () => {
    expect(newsletterDocumentFromContent({ subject: 'Old', html: '<p>Hi {{customer_name}}</p>' })).toEqual({
      subject: 'Old',
      preheader: '',
      fromName: '',
      blocks: [{ id: 'legacy-body', type: 'text', html: '<p>Hi {{first_name}}</p>' }],
    });
    expect(newsletterDocumentFromContent(null).blocks).toEqual([]);
  });

  it.each([
    { name: 'valid', tamper: (token: string) => token, expected: 'collector@example.com' },
    { name: 'altered email', tamper: (token: string) => `${Buffer.from('other@example.com').toString('base64url')}${token.slice(token.indexOf('.'))}`, expected: null },
    { name: 'altered signature', tamper: (token: string) => `${token.slice(0, -2)}xx`, expected: null },
    { name: 'missing', tamper: () => '', expected: null },
  ])('unsubscribe token: $name', ({ tamper, expected }) => {
    expect(verifyUnsubscribeToken(tamper(createUnsubscribeToken('Collector@Example.com')))).toBe(expected);
  });
});

describe('studio content authoring & presentation defaults', () => {
  it('leaves medium blank by default instead of injecting Mixed Media', () => {
    const product = productPayloadSchema.parse({
      title: 'Sunlit Postcard',
      price: 5,
      category: 'Postcards',
      images: { thumbnail: '', gallery: [] },
      shipping: { domestic: 2, international: 0 },
      specifications: { framed: false, signed: true, certificate: false },
    });
    const artwork = artworkPayloadSchema.parse({
      title: 'Quiet Sketch',
      images: { main: '', thumbnail: '', gallery: [] },
    });
    expect(product.medium).toBe('');
    expect(artwork.medium).toBe('');
  });

  it.each([
    { focus: 'top' as const, expected: 'object-top' },
    { focus: 'upper' as const, expected: 'object-[center_25%]' },
    { focus: 'center' as const, expected: 'object-center' },
    { focus: 'bottom' as const, expected: 'object-bottom' },
    { focus: undefined, expected: 'object-[center_25%]' },
  ])('maps hero image focus $focus to $expected', ({ focus, expected }) => {
    expect(homeHeroImagePositionClass(focus)).toBe(expected);
  });

  it('defaults portfolio layout showSoldBadge to false for quieter gallery presentation', () => {
    const parsed = portfolioPageSchema.parse({ title: 'Portfolio', subtitle: '' });
    expect(parsed.layout.showSoldBadge).toBe(false);
    expect(SITE_CONTENT_DEFAULTS.portfolio.layout.showSoldBadge).toBe(false);
  });

  it('supports photo-only quick portfolio posts and video-first galleries with still thumbnails', () => {
    const quick = sanitizeArtworkPayload(
      artworkPayloadSchema.parse({
        title: '',
        images: {
          main: 'https://artist.blob.core.windows.net/assets/images/painting.jpg',
          thumbnail: '',
          gallery: ['https://artist.blob.core.windows.net/assets/images/painting.jpg'],
        },
      }),
    );
    expect(quick.title).toBe('Untitled');
    expect(quick.slug).toMatch(/^untitled-[a-z0-9-]+$/);
    expect(quick.category).toEqual([]);
    expect(quick.available).toBe(false);

    expect(() =>
      artworkPayloadSchema.parse({
        title: '',
        images: { main: '', thumbnail: '', gallery: [] },
      }),
    ).toThrow(/Add a photo or enter a title/);

    const videoFirst = sanitizeArtworkPayload(
      artworkPayloadSchema.parse({
        title: 'Studio Reel',
        images: {
          main: 'https://artist.blob.core.windows.net/assets/videos/reel.mp4',
          thumbnail: 'https://artist.blob.core.windows.net/assets/videos/reel.mp4',
          gallery: [
            'https://artist.blob.core.windows.net/assets/videos/reel.mp4',
            'https://artist.blob.core.windows.net/assets/images/still.jpg',
          ],
        },
      }),
    );
    expect(videoFirst.images.main).toBe('https://artist.blob.core.windows.net/assets/images/still.jpg');
    expect(videoFirst.images.thumbnail).toBe('https://artist.blob.core.windows.net/assets/images/still.jpg');
    expect(videoFirst.images.gallery).toEqual([
      'https://artist.blob.core.windows.net/assets/videos/reel.mp4',
      'https://artist.blob.core.windows.net/assets/images/still.jpg',
    ]);
  });

  it.each([
    {
      draft: 'prints',
      existing: ['Originals', 'Prints', 'Postcards'],
      expected: { match: 'Prints', exact: true },
    },
    {
      draft: 'print',
      existing: ['Originals', 'Prints', 'Postcards'],
      expected: { match: 'Prints', exact: false },
    },
    {
      draft: 'Paintings',
      existing: ['Painting', 'Sculpture'],
      expected: { match: 'Painting', exact: false },
    },
    {
      draft: 'mixed-media',
      existing: ['Mixed Media', 'Acrylic'],
      expected: { match: 'Mixed Media', exact: false },
    },
    {
      draft: 'sketches',
      existing: ['Sketch', 'Watercolor'],
      expected: { match: 'Sketch', exact: false },
    },
    {
      draft: 'studies',
      existing: ['Study', 'Prints'],
      expected: { match: 'Study', exact: false },
    },
    {
      draft: 'Ceramics',
      existing: ['Originals', 'Prints', 'Canvas'],
      expected: null,
    },
  ])('flags exact and near-duplicate category "$draft"', ({ draft, existing, expected }) => {
    expect(findSimilarCategoryMatch(draft, existing)).toEqual(expected);
  });

  it('keeps distinct short or -ss/-us/-is/-as words consistent in canonicalCategoryStem', () => {
    expect(canonicalCategoryStem('Glass')).toBe('glass');
    expect(canonicalCategoryStem('Canvas')).toBe('canvas');
    expect(canonicalCategoryStem('Canvases')).toBe('canvas');
    expect(canonicalCategoryStem('Oil')).toBe('oil');
    expect(canonicalCategoryStem('Prints')).toBe(canonicalCategoryStem('print'));
  });
});
