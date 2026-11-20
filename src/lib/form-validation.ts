import { CONTACT_INQUIRY_KEYS } from '@/lib/site-content-shared';

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  inquiryType: string;
  /** Required when inquiryType is commission — size and medium together. */
  commissionSizeMedium: string;
  /** Required when inquiryType is commission. */
  commissionTimeline: string;
  /** Required when inquiryType is commission — subject matter or theme. */
  commissionTheme: string;
  /** Required when inquiryType is commission. */
  commissionBudget: string;
}

export interface ValidationErrors {
  [key: string]: string;
}

export function isCommissionInquiry(inquiryType: string): boolean {
  return inquiryType === 'commission';
}

const COMMISSION_FIELD_MAX = 300;

function requireCommissionText(
  value: string,
  fieldLabel: string,
  errors: ValidationErrors,
  errorKey: keyof ContactFormData,
): void {
  const trimmed = value.trim();
  if (!trimmed) {
    errors[errorKey] = `${fieldLabel} is required for commission requests`;
    return;
  }
  if (trimmed.length < 3) {
    errors[errorKey] = `${fieldLabel} must be at least 3 characters`;
    return;
  }
  if (trimmed.length > COMMISSION_FIELD_MAX) {
    errors[errorKey] = `${fieldLabel} must be less than ${COMMISSION_FIELD_MAX} characters`;
  }
}

export const validateEmail = (email: string): boolean => {
  const normalizedEmail = email.trim();
  if (!normalizedEmail || normalizedEmail.includes('..')) return false;

  const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
  return emailRegex.test(normalizedEmail);
};

export const validateContactForm = (data: ContactFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.name.trim()) {
    errors.name = 'Name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Name must be less than 100 characters';
  }

  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!data.subject.trim()) {
    errors.subject = 'Subject is required';
  } else if (data.subject.trim().length < 5) {
    errors.subject = 'Subject must be at least 5 characters';
  } else if (data.subject.trim().length > 200) {
    errors.subject = 'Subject must be less than 200 characters';
  }

  if (!data.message.trim()) {
    errors.message = 'Message is required';
  } else if (data.message.trim().length < 20) {
    errors.message = 'Message must be at least 20 characters';
  } else if (data.message.trim().length > 2000) {
    errors.message = 'Message must be less than 2000 characters';
  }

  if (!(CONTACT_INQUIRY_KEYS as readonly string[]).includes(data.inquiryType)) {
    errors.inquiryType = 'Please select a valid inquiry type';
  }

  if (isCommissionInquiry(data.inquiryType)) {
    requireCommissionText(data.commissionSizeMedium || '', 'Desired size and medium', errors, 'commissionSizeMedium');
    requireCommissionText(data.commissionTimeline || '', 'Timeline and deadline', errors, 'commissionTimeline');
    requireCommissionText(data.commissionTheme || '', 'Subject matter or theme', errors, 'commissionTheme');
    requireCommissionText(data.commissionBudget || '', 'Budget range', errors, 'commissionBudget');
  }

  return errors;
};

export const sanitizeFormData = (data: ContactFormData): ContactFormData => {
  const inquiryType = data.inquiryType;
  const base: ContactFormData = {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    subject: data.subject.trim(),
    message: data.message.trim(),
    inquiryType,
    commissionSizeMedium: '',
    commissionTimeline: '',
    commissionTheme: '',
    commissionBudget: '',
  };

  if (!isCommissionInquiry(inquiryType)) {
    return base;
  }

  return {
    ...base,
    commissionSizeMedium: String(data.commissionSizeMedium || '').trim(),
    commissionTimeline: String(data.commissionTimeline || '').trim(),
    commissionTheme: String(data.commissionTheme || '').trim(),
    commissionBudget: String(data.commissionBudget || '').trim(),
  };
};

/** Structured commission details for email / inbox bodies. */
export function formatCommissionInquiryDetails(data: ContactFormData): string | null {
  if (!isCommissionInquiry(data.inquiryType)) return null;
  return [
    `Desired size and medium: ${data.commissionSizeMedium}`,
    `Timeline and deadline: ${data.commissionTimeline}`,
    `Subject matter or theme: ${data.commissionTheme}`,
    `Budget range: ${data.commissionBudget}`,
  ].join('\n');
}

// Rate limiting utilities
export const isRateLimited = (identifier: string, windowMs = 60000, maxRequests = 3): boolean => {
  const key = `contact_rate_limit_${identifier}`;
  const now = Date.now();
  
  const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
  const stored = storage?.getItem(key) || null;
  let requests;
  
  try {
    requests = stored ? JSON.parse(stored) : [];
  } catch {
    requests = [];
  }
  
  const recentRequests = requests.filter((timestamp: number) => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return true;
  }
  
  recentRequests.push(now);
  if (storage) {
    storage.setItem(key, JSON.stringify(recentRequests));
  }
  
  return false;
};
