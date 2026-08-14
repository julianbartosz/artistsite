'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { validateContactForm, sanitizeFormData, isRateLimited, type ContactFormData, type ValidationErrors } from '@/lib/form-validation';

const DEFAULT_CONTACT_EMAIL = 'hello@artistsite.com';

export default function ContactPage() {
  const [contactEmail, setContactEmail] = useState(DEFAULT_CONTACT_EMAIL);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
    inquiryType: 'general'
  });
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [responseMessage, setResponseMessage] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;

    let active = true;

    fetch('/api/config/public')
      .then((response) => response.ok ? response.json() : null)
      .then((config) => {
        const configuredEmail = config?.CONTACT_EMAIL || config?.ARTIST_EMAIL || config?.SUPPORT_EMAIL;
        if (active && configuredEmail) setContactEmail(configuredEmail);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    const sanitizedData = sanitizeFormData(formData);
    const validationErrors = validateContactForm(sanitizedData);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setTouched({
        name: true,
        email: true,
        subject: true,
        message: true,
        inquiryType: true
      });
      return;
    }

    // Check rate limiting
    if (isRateLimited(sanitizedData.email)) {
      setStatus('error');
      setResponseMessage('Too many requests. Please wait a moment before submitting again.');
      return;
    }

    setStatus('loading');
    setErrors({});

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitizedData),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus('success');
        setResponseMessage('Thank you for your message! I\'ll get back to you within 24-48 hours.');
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: '',
          inquiryType: 'general'
        });
        setTouched({});
      } else {
        throw new Error(result.message || result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Contact form error:', error);
      setStatus('error');
      setResponseMessage(
        error instanceof Error 
          ? error.message 
          : `Something went wrong. Please try again or email me directly at ${contactEmail}`
      );
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Reset status if it was an error
    if (status === 'error') {
      setStatus('idle');
      setResponseMessage('');
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validate this field on blur
    const sanitizedData = sanitizeFormData(formData);
    const fieldErrors = validateContactForm(sanitizedData);
    
    if (fieldErrors[field]) {
      setErrors(prev => ({ ...prev, [field]: fieldErrors[field] }));
    }
  };

  const getFieldError = (field: string) => {
    return touched[field] && errors[field] ? errors[field] : '';
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Get in Touch</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            I&apos;d love to hear from you. Whether you&apos;re interested in purchasing artwork, 
            commissioning a custom piece, or just want to say hello, don&apos;t hesitate to reach out.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send a Message</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {Object.keys(errors).length > 0 && (
                <div data-testid="form-errors" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  Please fix the highlighted fields before sending your message.
                </div>
              )}

              {/* Inquiry Type */}
              <div>
                <label htmlFor="inquiryType" className="block text-sm font-medium text-gray-700 mb-2">
                  Type of Inquiry
                </label>
                <select
                  id="inquiryType"
                  name="inquiryType"
                  value={formData.inquiryType}
                  onChange={handleChange}
                  onBlur={() => handleBlur('inquiryType')}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors ${
                    getFieldError('inquiryType') 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-gray-300 focus:border-blue-500'
                  }`}
                >
                  <option value="general">General Inquiry</option>
                  <option value="purchase">Purchase Artwork</option>
                  <option value="commission">Commission Request</option>
                  <option value="press">Press & Media</option>
                  <option value="exhibition">Exhibition Opportunity</option>
                </select>
                {getFieldError('inquiryType') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('inquiryType')}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={() => handleBlur('name')}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors ${
                    getFieldError('name') 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-gray-300 focus:border-blue-500'
                  }`}
                  placeholder="Your full name"
                  aria-describedby={getFieldError('name') ? 'name-error' : undefined}
                />
                {getFieldError('name') && (
                  <p id="name-error" className="mt-1 text-sm text-red-600">{getFieldError('name')}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors ${
                    getFieldError('email') 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-gray-300 focus:border-blue-500'
                  }`}
                  placeholder="your@email.com"
                  aria-describedby={getFieldError('email') ? 'email-error' : undefined}
                />
                {getFieldError('email') && (
                  <p id="email-error" className="mt-1 text-sm text-red-600">{getFieldError('email')}</p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  onBlur={() => handleBlur('subject')}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors ${
                    getFieldError('subject') 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-gray-300 focus:border-blue-500'
                  }`}
                  placeholder="What's this about?"
                  aria-describedby={getFieldError('subject') ? 'subject-error' : undefined}
                />
                {getFieldError('subject') && (
                  <p id="subject-error" className="mt-1 text-sm text-red-600">{getFieldError('subject')}</p>
                )}
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message * 
                  <span className="text-gray-500 text-xs ml-2">
                    ({formData.message.length}/2000 characters)
                  </span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  onBlur={() => handleBlur('message')}
                  rows={6}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors resize-vertical ${
                    getFieldError('message') 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-gray-300 focus:border-blue-500'
                  }`}
                  placeholder="Tell me more about your inquiry..."
                  aria-describedby={getFieldError('message') ? 'message-error' : undefined}
                />
                {getFieldError('message') && (
                  <p id="message-error" className="mt-1 text-sm text-red-600">{getFieldError('message')}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                {status === 'loading' ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Message'
                )}
              </button>

              {/* Status Message */}
              {responseMessage && (
                <div 
                  className={`p-4 rounded-lg border ${
                    status === 'success' 
                      ? 'bg-green-50 text-green-800 border-green-200' 
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                  role="alert"
                >
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {status === 'success' ? (
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">{responseMessage}</p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Contact Information & Bio */}
          <div className="space-y-8">
            {/* Artist Photo */}
            <div className="text-center">
              <div className="relative w-48 h-48 mx-auto mb-6 rounded-full overflow-hidden">
                <Image
                  src="/images/artist-portrait.jpg"
                  alt="Artist portrait"
                  fill
                  className="object-cover"
                  sizes="192px"
                />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Let&apos;s Connect</h3>
              <p className="text-gray-600">
                I&apos;m always excited to discuss art, collaborate on projects, or simply chat about creativity.
              </p>
            </div>

            {/* Contact Details */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-700">{contactEmail}</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-700">New York, NY</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span className="text-gray-700">@artistsite</span>
                </div>
              </div>
            </div>

            {/* Response Time */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Response Time</h3>
              <p className="text-gray-700 text-sm mb-3">
                I typically respond to all inquiries within 24-48 hours. For urgent matters or commission deadlines, 
                please mention this in your message.
              </p>
              <div className="text-xs text-blue-600">
                <p>• Purchase inquiries: Same day</p>
                <p>• Commission requests: 1-2 days</p>
                <p>• General questions: 24-48 hours</p>
              </div>
            </div>

            {/* Commission Info */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Commission Work</h3>
              <p className="text-gray-700 text-sm mb-3">
                I accept a limited number of commission projects each year. Please include details about:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Desired size and medium</li>
                <li>• Timeline and deadline</li>
                <li>• Subject matter or theme</li>
                <li>• Budget range</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}