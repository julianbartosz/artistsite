// filepath: src/ui/components/marketing/NewsletterSignup.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useNewsletterTracking } from '@ui/components/analytics/AnalyticsProvider';
interface NewsletterSignupProps {
  className?: string;
}
export function NewsletterSignup({ className = "" }: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isClient, setIsClient] = useState(false);
  const tracking = useNewsletterTracking();
  useEffect(() => { setIsClient(true); }, []);
  const safeTrackFormView = useCallback(() => {
    if (!isClient) return;
    try { tracking?.trackFormView?.(); } catch {}
  }, [isClient, tracking]);
  const safeTrackSignup = useCallback((method: string) => {
    if (!isClient) return;
    try { tracking?.trackSignup?.(method); } catch {}
  }, [isClient, tracking]);
  useEffect(() => { if (isClient) safeTrackFormView(); }, [isClient, safeTrackFormView]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setStatus('error'); setMessage('Please enter your email address'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setStatus('error'); setMessage('Please enter a valid email address'); return; }
    setStatus('loading');
    try {
      const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (response.ok) {
        await new Promise((r) => setTimeout(r, 300));
        setStatus('success'); setMessage('Thank you for subscribing! Check your email for confirmation.'); setEmail('');
        safeTrackSignup('form');
      } else {
        if (response.status === 409) { setStatus('error'); setMessage('This email is already subscribed to our newsletter.'); }
        else if (response.status === 400) { setStatus('error'); setMessage('Please enter a valid email address.'); }
        else { setStatus('error'); setMessage('Something went wrong. Please try again later.'); }
      }
    } catch {
      setStatus('error'); setMessage('Network error. Please check your connection and try again.');
    }
  };
  const resetForm = () => { setStatus('idle'); setMessage(''); };
  return (
    <div className={className} aria-busy={status === 'loading'}>
      {/* Added noValidate to disable native HTML email validation so our custom validation runs in tests */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (status === 'error') resetForm(); }} placeholder="Enter your email" className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300" disabled={status === 'loading'} data-testid="newsletter-email" />
        <button type="submit" disabled={status === 'loading' || status === 'success'} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed" data-testid="newsletter-submit">
          {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
        </button>
      </form>
      {message && (
        <div className={`text-sm mt-4 text-center ${status === 'success' ? 'text-green-400' : 'text-red-400'}`} data-testid={status === 'success' ? 'newsletter-success' : undefined}>
          <p>{message}</p>
          {status === 'success' && (
            <button onClick={() => { setStatus('idle'); setMessage(''); }} className="text-green-300 hover:text-green-200 underline mt-2 text-xs">Subscribe another email</button>
          )}
        </div>
      )}
      {status === 'idle' && (<p className="text-sm text-gray-400 mt-4 text-center">No spam, unsubscribe at any time.</p>)}
    </div>
  );
}
export default NewsletterSignup;
