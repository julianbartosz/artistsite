'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get('email') || '');
    setToken(params.get('token') || '');
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to reset password');
      setMessage('Password reset successfully. Redirecting to sign in...');
      setTimeout(() => router.push('/auth/signin'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const linkMissing = !email || !token;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Choose a new password</h1>
        <p className="mt-2 text-center text-sm text-gray-600">Use the reset link from your email to update your password.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {linkMissing ? (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">This reset link is missing required information.</div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {message && <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
              {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">New password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            <Link href="/auth/forgot" className="font-medium text-indigo-600 hover:text-indigo-500">Request a new reset link</Link>
          </div>
        </div>
      </div>
    </div>
  );
}