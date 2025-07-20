import { 
  validateEmail, 
  validateContactForm, 
  sanitizeFormData, 
  isRateLimited,
  type ContactFormData 
} from '@/lib/form-validation';

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
      inquiryType: 'general'
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
        const validTypes = ['general', 'purchase', 'commission', 'press', 'exhibition'];
        
        validTypes.forEach(type => {
          const errors = validateContactForm({ ...validFormData, inquiryType: type });
          expect(errors.inquiryType).toBeUndefined();
        });
      });
    });

    it('returns multiple errors when multiple fields are invalid', () => {
      const invalidData: ContactFormData = {
        name: '',
        email: 'invalid-email',
        subject: 'Hi',
        message: 'Short',
        inquiryType: 'invalid'
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
        inquiryType: 'general'
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
        inquiryType: 'general'
      };

      const sanitized = sanitizeFormData(data);
      expect(sanitized.email).toBe('john@example.com');
    });

    it('preserves inquiry type exactly', () => {
      const data: ContactFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message',
        inquiryType: 'commission'
      };

      const sanitized = sanitizeFormData(data);
      expect(sanitized.inquiryType).toBe('commission');
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