// Form validation utilities for contact and other forms
export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  inquiryType: string;
}

export interface ValidationErrors {
  [key: string]: string;
}

export const validateEmail = (email: string): boolean => {
  const normalizedEmail = email.trim();
  if (!normalizedEmail || normalizedEmail.includes('..')) return false;

  const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
  return emailRegex.test(normalizedEmail);
};

export const validateContactForm = (data: ContactFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Name validation
  if (!data.name.trim()) {
    errors.name = 'Name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Name must be less than 100 characters';
  }

  // Email validation
  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }

  // Subject validation
  if (!data.subject.trim()) {
    errors.subject = 'Subject is required';
  } else if (data.subject.trim().length < 5) {
    errors.subject = 'Subject must be at least 5 characters';
  } else if (data.subject.trim().length > 200) {
    errors.subject = 'Subject must be less than 200 characters';
  }

  // Message validation
  if (!data.message.trim()) {
    errors.message = 'Message is required';
  } else if (data.message.trim().length < 20) {
    errors.message = 'Message must be at least 20 characters';
  } else if (data.message.trim().length > 2000) {
    errors.message = 'Message must be less than 2000 characters';
  }

  // Inquiry type validation
  const validInquiryTypes = ['general', 'purchase', 'commission', 'press', 'exhibition'];
  if (!validInquiryTypes.includes(data.inquiryType)) {
    errors.inquiryType = 'Please select a valid inquiry type';
  }

  return errors;
};

export const sanitizeFormData = (data: ContactFormData): ContactFormData => {
  return {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    subject: data.subject.trim(),
    message: data.message.trim(),
    inquiryType: data.inquiryType,
  };
};

// Rate limiting utilities
export const isRateLimited = (identifier: string, windowMs = 60000, maxRequests = 3): boolean => {
  const key = `contact_rate_limit_${identifier}`;
  const now = Date.now();
  
  // Get existing requests from localStorage (client-side) or implement server-side storage
  const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
  const stored = storage?.getItem(key) || null;
  let requests;
  
  try {
    requests = stored ? JSON.parse(stored) : [];
  } catch (error) {
    // Handle malformed JSON gracefully
    requests = [];
  }
  
  // Filter out requests outside the time window
  const recentRequests = requests.filter((timestamp: number) => now - timestamp < windowMs);
  
  // Check if rate limit exceeded
  if (recentRequests.length >= maxRequests) {
    return true;
  }
  
  // Add current request and update storage
  recentRequests.push(now);
  if (storage) {
    storage.setItem(key, JSON.stringify(recentRequests));
  }
  
  return false;
};