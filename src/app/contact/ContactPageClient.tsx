'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  validateContactForm,
  sanitizeFormData,
  isRateLimited,
  type ContactFormData,
  type ValidationErrors,
} from '@/lib/form-validation';
import type { ContactPageContent } from '@/lib/site-content-shared';
import { defaultInquiryType, htmlHasVisibleText, visibleInquiryTypes } from '@/lib/site-content-shared';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';

interface ContactPageClientProps {
  pageContent: ContactPageContent;
  contactEmail: string;
}

export default function ContactPageClient({ pageContent, contactEmail: initialContactEmail }: ContactPageClientProps) {
  const inquiryOptions = visibleInquiryTypes(pageContent);
  const fallbackInquiryType = defaultInquiryType(pageContent);
  const form = pageContent.form;
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
    inquiryType: fallbackInquiryType,
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [responseMessage, setResponseMessage] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setContactEmail(initialContactEmail);
  }, [initialContactEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedData = sanitizeFormData(formData);
    const validationErrors = validateContactForm(sanitizedData);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setTouched({
        name: true,
        email: true,
        subject: true,
        message: true,
        inquiryType: true,
      });
      return;
    }

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedData),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus('success');
        setResponseMessage(pageContent.form.successMessage);
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: '',
          inquiryType: fallbackInquiryType,
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
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    if (status === 'error') {
      setStatus('idle');
      setResponseMessage('');
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const fieldErrors = validateContactForm(sanitizeFormData(formData));
    if (fieldErrors[field]) {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  };

  const getFieldError = (field: string) => (touched[field] && errors[field] ? errors[field] : '');

  return (
    <div className="min-h-screen bg-white">
      <section className="relative group bg-gray-50 section-space-tight">
        <CmsEditAnchor targetKey="contact:header" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{pageContent.header.title}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">{pageContent.header.subtitle}</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          <aside className="relative group order-2 lg:order-none lg:col-start-2 lg:row-start-1 space-y-6">
            <CmsEditAnchor targetKey="contact:sidebar" />
            <div className="text-center lg:text-left">
              {pageContent.portraitImage && (
                <div className="relative w-24 h-24 lg:w-48 lg:h-48 mx-auto lg:mx-0 mb-4 lg:mb-6 rounded-full overflow-hidden">
                  <Image src={pageContent.portraitImage} alt="Artist portrait" fill className="object-cover" sizes="(max-width: 1024px) 96px, 192px" />
                </div>
              )}
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{pageContent.sidebar.connectTitle}</h3>
              <p className="text-gray-600">{pageContent.sidebar.connectText}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{pageContent.sidebar.contactInfoTitle}</h3>
              <div className="space-y-2 text-gray-700">
                <p>{contactEmail}</p>
                {pageContent.sidebar.location && <p>{pageContent.sidebar.location}</p>}
                {pageContent.sidebar.instagramHandle && <p>{pageContent.sidebar.instagramHandle}</p>}
              </div>
            </div>

            {htmlHasVisibleText(pageContent.sidebar.responseTimeHtml) && (
            <details className="rounded-lg border border-gray-200 p-4 desktop-open">
              <summary className="cursor-pointer text-lg font-semibold text-gray-900 lg:cursor-default">{pageContent.sidebar.responseTimeTitle}</summary>
              <div className="prose prose-sm max-w-none text-gray-700 mt-3" dangerouslySetInnerHTML={{ __html: pageContent.sidebar.responseTimeHtml }} />
            </details>
            )}

            {htmlHasVisibleText(pageContent.sidebar.commissionHtml) && (
            <details className="rounded-lg border border-gray-200 p-4 desktop-open">
              <summary className="cursor-pointer text-lg font-semibold text-gray-900 lg:cursor-default">{pageContent.sidebar.commissionTitle}</summary>
              <div className="prose prose-sm max-w-none text-gray-700 mt-3" dangerouslySetInnerHTML={{ __html: pageContent.sidebar.commissionHtml }} />
            </details>
            )}
          </aside>

          <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{pageContent.form.title}</h2>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {Object.keys(errors).length > 0 && (
                <div data-testid="form-errors" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  Please fix the highlighted fields before sending your message.
                </div>
              )}

              {inquiryOptions.length > 0 && (
              <div>
                <label htmlFor="inquiryType" className="block text-sm font-medium text-gray-700 mb-2">
                  {form.inquiryLabel}
                </label>
                <select
                  id="inquiryType"
                  name="inquiryType"
                  value={formData.inquiryType}
                  onChange={handleChange}
                  onBlur={() => handleBlur('inquiryType')}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-gray-900 transition-colors ${
                    getFieldError('inquiryType') ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-gray-900'
                  }`}
                >
                  {inquiryOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
                {getFieldError('inquiryType') && <p className="mt-1 text-sm text-red-600">{getFieldError('inquiryType')}</p>}
              </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">{form.nameLabel} *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={() => handleBlur('name')}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-gray-900 transition-colors ${
                    getFieldError('name') ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-gray-900'
                  }`}
                  placeholder={form.namePlaceholder}
                  aria-describedby={getFieldError('name') ? 'name-error' : undefined}
                />
                {getFieldError('name') && <p id="name-error" className="mt-1 text-sm text-red-600">{getFieldError('name')}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">{form.emailLabel} *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-gray-900 transition-colors ${
                    getFieldError('email') ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-gray-900'
                  }`}
                  placeholder={form.emailPlaceholder}
                  aria-describedby={getFieldError('email') ? 'email-error' : undefined}
                />
                {getFieldError('email') && <p id="email-error" className="mt-1 text-sm text-red-600">{getFieldError('email')}</p>}
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">{form.subjectLabel} *</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  onBlur={() => handleBlur('subject')}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-gray-900 transition-colors ${
                    getFieldError('subject') ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-gray-900'
                  }`}
                  placeholder={form.subjectPlaceholder}
                  aria-describedby={getFieldError('subject') ? 'subject-error' : undefined}
                />
                {getFieldError('subject') && <p id="subject-error" className="mt-1 text-sm text-red-600">{getFieldError('subject')}</p>}
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  {form.messageLabel} *
                  <span className="text-gray-500 text-xs ml-2">({formData.message.length}/2000 characters)</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  onBlur={() => handleBlur('message')}
                  rows={6}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-gray-900 transition-colors resize-vertical ${
                    getFieldError('message') ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-gray-900'
                  }`}
                  placeholder={form.messagePlaceholder}
                  aria-describedby={getFieldError('message') ? 'message-error' : undefined}
                />
                {getFieldError('message') && <p id="message-error" className="mt-1 text-sm text-red-600">{getFieldError('message')}</p>}
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'Sending...' : form.submitLabel}
              </button>

              {responseMessage && (
                <div
                  data-testid={status === 'success' ? 'contact-form-success' : 'contact-form-error'}
                  className={`p-4 rounded-lg border ${
                    status === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                  role="alert"
                >
                  <p className="text-sm font-medium">{responseMessage}</p>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
