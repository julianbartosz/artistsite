'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNewsletterTracking } from '@/components/AnalyticsProvider';

interface NewsletterSignupProps {
  className?: string;
  placeholder?: string;
  buttonLabel?: string;
  disclaimer?: string;
  variant?: 'onLight' | 'onDark';
}

export function NewsletterSignup({
  className = "",
  placeholder = "Enter your email",
  buttonLabel = "Subscribe",
  disclaimer = "No spam, unsubscribe at any time.",
  variant = 'onLight',
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const hasTrackedViewRef = useRef(false);

  // Get tracking functions but handle potential errors
  const tracking = useNewsletterTracking();

  const safeTrackSignup = useCallback((method: string) => {
    try {
      tracking?.trackSignup?.(method);
    } catch (error) {
      console.warn('Analytics tracking error:', error);
    }
  }, [tracking]);

  // Track form view at most once per mount when tracking is enabled
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
    
    if (!email) {
      setStatus('error');
      setMessage('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');
    
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus('success');
        setMessage('Thank you for subscribing! Check your email for confirmation.');
        setEmail('');
        
        // Track successful newsletter signup with error handling
        safeTrackSignup('form');
      } else {
        // Handle specific error cases
        if (response.status === 409) {
          setStatus('error');
          setMessage('This email is already subscribed to our newsletter.');
        } else if (response.status === 400) {
          setStatus('error');
          setMessage('Please enter a valid email address.');
        } else {
          setStatus('error');
          setMessage('Something went wrong. Please try again later.');
        }
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      setStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    }
  };

  const resetForm = () => {
    setStatus('idle');
    setMessage('');
  };

  const buttonClass = variant === 'onDark'
    ? 'bg-white text-primary px-6 py-3 rounded-button hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed'
    : 'btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={className}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
        <input
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
        <div className={`text-sm mt-4 text-center ${
          status === 'success' ? 'text-green-400' : 'text-red-400'
        }`} data-testid={status === 'success' ? 'newsletter-success' : 'newsletter-error'}>
          <p>{message}</p>
          {status === 'success' && (
            <button
              onClick={() => {
                setStatus('idle');
                setMessage('');
              }}
              className="text-green-300 hover:text-green-200 underline mt-2 text-xs"
            >
              Subscribe another email
            </button>
          )}
        </div>
      )}
      
      {status === 'idle' && disclaimer && (
        <p className="text-sm text-gray-400 mt-4 text-center">
          {disclaimer}
        </p>
      )}
    </div>
  );
}