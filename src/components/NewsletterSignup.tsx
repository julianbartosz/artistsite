'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNewsletterTracking } from '@/components/AnalyticsProvider';
import { ConversionFunnels } from '@/lib/analytics/funnels';

const KIOSK_QUEUE_KEY = 'studio_kiosk_signup_queue';

interface QueuedKioskSignup {
  email: string;
  firstName?: string;
  eventSlug?: string;
  queuedAt: string;
}

function readKioskQueue(): QueuedKioskSignup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KIOSK_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeKioskQueue(items: QueuedKioskSignup[]) {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(KIOSK_QUEUE_KEY);
    } else {
      window.localStorage.setItem(KIOSK_QUEUE_KEY, JSON.stringify(items));
    }
  } catch {
    // Ignore storage quota errors
  }
}

interface NewsletterSignupProps {
  className?: string;
  placeholder?: string;
  buttonLabel?: string;
  disclaimer?: string;
  variant?: 'onLight' | 'onDark';
  eventSlug?: string;
  eventName?: string;
  kiosk?: boolean;
}

export function NewsletterSignup({
  className = '',
  placeholder = 'Enter your email',
  buttonLabel = 'Subscribe',
  disclaimer = 'No spam, unsubscribe at any time.',
  variant = 'onLight',
  eventSlug: eventSlugProp,
  eventName,
  kiosk = false,
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [resolvedEventSlug, setResolvedEventSlug] = useState<string | undefined>(eventSlugProp);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [queuedCount, setQueuedCount] = useState(0);
  const hasTrackedViewRef = useRef(false);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const tracking = useNewsletterTracking();

  const safeTrackSignup = useCallback((method: string) => {
    try {
      tracking?.trackSignup?.(method);
    } catch (error) {
      console.warn('Analytics tracking error:', error);
    }
  }, [tracking]);

  useEffect(() => {
    if (eventSlugProp) {
      setResolvedEventSlug(eventSlugProp);
      return;
    }
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const detected = params.get('event')?.trim() || params.get('utm_campaign')?.trim() || undefined;
    if (detected) setResolvedEventSlug(detected);
  }, [eventSlugProp]);

  const flushKioskQueue = useCallback(async () => {
    const queue = readKioskQueue();
    setQueuedCount(queue.length);
    if (queue.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return;
    }

    const remaining: QueuedKioskSignup[] = [];
    for (const entry of queue) {
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: entry.email,
            ...(entry.firstName ? { firstName: entry.firstName } : {}),
            ...(entry.eventSlug ? { eventSlug: entry.eventSlug } : {}),
          }),
        });
        if (!res.ok && res.status !== 409 && res.status !== 400) {
          remaining.push(entry);
        }
      } catch {
        remaining.push(entry);
      }
    }
    writeKioskQueue(remaining);
    setQueuedCount(remaining.length);
  }, []);

  useEffect(() => {
    if (!kiosk) return;
    void flushKioskQueue();
    const onOnline = () => {
      void flushKioskQueue();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [kiosk, flushKioskQueue]);

  useEffect(() => {
    if (!kiosk || status !== 'success') return;
    const timer = window.setTimeout(() => {
      setStatus('idle');
      setMessage('');
      emailInputRef.current?.focus();
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [kiosk, status]);

  useEffect(() => {
    if (hasTrackedViewRef.current) return;
    if (tracking && 'isTrackingEnabled' in tracking && !tracking.isTrackingEnabled) return;
    hasTrackedViewRef.current = true;
    try {
      tracking?.trackFormView?.();
    } catch (error) {
      console.warn('Analytics tracking error:', error);
    }
  }, [tracking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedFirstName = firstName.trim();

    if (!trimmedEmail) {
      setStatus('error');
      setMessage('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');

    const enqueueOffline = () => {
      const existing = readKioskQueue();
      const next = [
        ...existing.filter((item) => item.email.toLowerCase() !== trimmedEmail.toLowerCase()),
        {
          email: trimmedEmail,
          ...(trimmedFirstName ? { firstName: trimmedFirstName } : {}),
          ...(resolvedEventSlug ? { eventSlug: resolvedEventSlug } : {}),
          queuedAt: new Date().toISOString(),
        },
      ];
      writeKioskQueue(next);
      setQueuedCount(next.length);
      setStatus('success');
      setMessage('Saved! Your email will sync automatically as soon as the signal returns.');
      setEmail('');
      setFirstName('');
    };

    if (kiosk && typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOffline();
      return;
    }

    try {
      const sessionId = kiosk ? undefined : ConversionFunnels.getSessionId() || undefined;
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          ...(trimmedFirstName ? { firstName: trimmedFirstName } : {}),
          ...(resolvedEventSlug ? { eventSlug: resolvedEventSlug } : {}),
          ...(sessionId ? { sessionId } : {}),
        }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({} as { emailSent?: boolean; alreadySubscribed?: boolean }));
        setStatus('success');
        if (kiosk) {
          setMessage(
            data?.alreadySubscribed
              ? `Welcome back${trimmedFirstName ? `, ${trimmedFirstName}` : ''}! We noted your visit today.`
              : `Thanks for stopping by${eventName ? ` ${eventName}` : ''}${trimmedFirstName ? `, ${trimmedFirstName}` : ''}! You're on the studio list.`,
          );
        } else {
          setMessage(
            data?.alreadySubscribed
              ? "You're already on the list! We noted your visit today."
              : data?.emailSent === true
                ? 'Thank you for subscribing! Check your inbox for a welcome note from the studio.'
                : "You're on the list! We'll write when new artwork and studio updates arrive.",
          );
        }
        setEmail('');
        setFirstName('');
        safeTrackSignup(kiosk ? 'booth_kiosk' : 'form');
      } else if (response.status === 409) {
        setStatus('error');
        setMessage('This email is already subscribed to our newsletter.');
      } else if (response.status === 400) {
        setStatus('error');
        setMessage('Please enter a valid email address.');
      } else {
        setStatus('error');
        setMessage('Something went wrong. Please try again later.');
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      if (kiosk) {
        enqueueOffline();
        return;
      }
      setStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    }
  };

  const resetForm = () => {
    setStatus('idle');
    setMessage('');
    if (kiosk) {
      window.setTimeout(() => emailInputRef.current?.focus(), 0);
    }
  };

  const isDark = variant === 'onDark';
  const buttonClass = isDark
    ? 'bg-white text-primary px-6 py-3 rounded-button hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed'
    : 'btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed';
  const successTextClass = isDark ? 'text-green-300' : 'text-green-700';
  const errorTextClass = isDark ? 'text-red-300' : 'text-red-700';
  const resetButtonClass = isDark
    ? 'text-green-200 hover:text-white underline mt-2 text-xs'
    : 'text-green-800 hover:text-green-950 underline mt-2 text-xs';
  const disclaimerTextClass = isDark ? 'text-gray-300' : 'text-gray-600';

  if (kiosk) {
    return (
      <div className={className} data-testid="booth-kiosk-form">
        {status === 'success' ? (
          <div
            data-testid="newsletter-success"
            className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center shadow-sm"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-emerald-950">{message}</p>
            <p className="mt-2 text-sm text-emerald-800">Resetting for the next guest…</p>
            <button
              type="button"
              onClick={resetForm}
              className="mt-5 inline-flex items-center rounded-button border border-emerald-300 bg-white px-5 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              Next guest now
            </button>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4 text-left">
            <div>
              <label htmlFor="kiosk-first-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                First Name (optional)
              </label>
              <input
                id="kiosk-first-name"
                data-testid="kiosk-first-name"
                type="text"
                autoComplete="off"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                disabled={status === 'loading'}
                className="w-full px-4 py-4 text-base rounded-input bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary border border-gray-300"
              />
            </div>

            <div>
              <label htmlFor="kiosk-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                ref={emailInputRef}
                id="kiosk-email"
                data-testid="newsletter-email"
                type="email"
                autoComplete="off"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') resetForm();
                }}
                placeholder={placeholder}
                disabled={status === 'loading'}
                className="w-full px-4 py-4 text-base rounded-input bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary border border-gray-300"
              />
            </div>

            {status === 'error' && message && (
              <p className="text-sm font-medium text-red-700" data-testid="newsletter-error" role="alert">
                {message}
              </p>
            )}

            <button
              data-testid="newsletter-submit"
              type="submit"
              disabled={status === 'loading'}
              className="w-full btn-primary py-4 px-6 text-base font-semibold disabled:opacity-50"
            >
              {status === 'loading' ? 'Saving...' : buttonLabel === 'Subscribe' ? 'Join the Studio List' : buttonLabel}
            </button>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs text-gray-500">
              <span>{disclaimer}</span>
              {queuedCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-900">
                  {queuedCount} queued offline
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
        <input
          ref={emailInputRef}
          data-testid="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') resetForm();
          }}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 rounded-input bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary border border-gray-300"
          disabled={status === 'loading'}
        />
        <button
          data-testid="newsletter-submit"
          type="submit"
          disabled={status === 'loading' || status === 'success'}
          className={buttonClass}
        >
          {status === 'loading' ? 'Subscribing...' : buttonLabel}
        </button>
      </form>

      {message && (
        <div
          className={`text-sm mt-4 text-center ${status === 'success' ? successTextClass : errorTextClass}`}
          data-testid={status === 'success' ? 'newsletter-success' : 'newsletter-error'}
        >
          <p>{message}</p>
          {status === 'success' && (
            <button onClick={resetForm} className={resetButtonClass}>
              Subscribe another email
            </button>
          )}
        </div>
      )}

      {status === 'idle' && disclaimer && (
        <p className={`text-sm ${disclaimerTextClass} mt-4 text-center`}>
          {disclaimer}
        </p>
      )}
    </div>
  );
}
