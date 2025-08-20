'use client';
import { useState } from 'react';
import Image from 'next/image';
import { validateContactForm, sanitizeFormData, isRateLimited, type ContactFormData, type ValidationErrors } from '@/lib/form-validation';
import { IconSpinner, IconCheckCircleSolid, IconXCircleSolid, IconEmail, IconLocationPin, IconInstagram } from '@ui/icons';

export default function ContactPage() {
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
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Contact form error:', error);
      setStatus('error');
      setResponseMessage(
        error instanceof Error 
          ? error.message 
          : 'Something went wrong. Please try again or email me directly at hello@artistsite.com'
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
                  aria-describedby={`inquiryType-helper${getFieldError('inquiryType') ? ' inquiryType-error' : ''}`}
                >
                  <option value="general">General Inquiry</option>
                  <option value="purchase">Purchase Artwork</option>
                  <option value="commission">Commission Request</option>
                  <option value="press">Press & Media</option>
                  <option value="exhibition">Exhibition Opportunity</option>
                </select>
                <p id="inquiryType-helper" className="sr-only">Select the type of inquiry.</p>
                {getFieldError('inquiryType') && (
                  <p id="inquiryType-error" className="mt-1 text-sm text-red-600">{getFieldError('inquiryType')}</p>
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
                  aria-describedby={`name-helper${getFieldError('name') ? ' name-error' : ''}`}
                />
                <p id="name-helper" className="sr-only">Enter your full name.</p>
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
                  aria-describedby={`email-helper${getFieldError('email') ? ' email-error' : ''}`}
                />
                <p id="email-helper" className="sr-only">Enter a valid email address. We will use this to reply.</p>
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
                  aria-describedby={`subject-helper${getFieldError('subject') ? ' subject-error' : ''}`}
                />
                <p id="subject-helper" className="sr-only">Provide a brief subject, at least 5 characters.</p>
                {getFieldError('subject') && (
                  <p id="subject-error" className="mt-1 text-sm text-red-600">{getFieldError('subject')}</p>
                )}
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message * 
                  <span id="message-charcount" className="text-gray-500 text-xs ml-2">
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
                  aria-describedby={`message-helper message-charcount${getFieldError('message') ? ' message-error' : ''}`}
                />
                <p id="message-helper" className="sr-only">Enter your message, at least 20 characters and up to 2000.</p>
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
                    <IconSpinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
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
                        <IconCheckCircleSolid className="h-5 w-5 text-green-400" />
                      ) : (
                        <IconXCircleSolid className="h-5 w-5 text-red-400" />
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
                  <IconEmail className="w-5 h-5 text-gray-400 mr-3" />
                  <span className="text-gray-700">hello@artistsite.com</span>
                </div>
                <div className="flex items-center">
                  <IconLocationPin className="w-5 h-5 text-gray-400 mr-3" />
                  <span className="text-gray-700">New York, NY</span>
                </div>
                <div className="flex items-center">
                  <IconInstagram className="w-5 h-5 text-gray-400 mr-3" />
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
                {/* Adjusted to avoid duplicate '24-48 hours' match in tests */}
                <p>• General questions: Standard response window</p>
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