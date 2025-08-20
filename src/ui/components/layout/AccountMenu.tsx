'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Session } from 'next-auth';

export function AccountMenu({ session, onSignOut }: { session: Session | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  if (!session) {
    return (
      <div className="hidden md:block">
        <div className="flex items-center space-x-2">
          <Link href="/auth/signin" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
            Sign In
          </Link>
          <Link href="/auth/signup" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Sign Up
          </Link>
        </div>
      </div>
    );
  }
  const userLabel = session.user?.name || session.user?.email || 'User';
  return (
    <div className="hidden md:block">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <span className="sr-only">Open user menu</span>
          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
            </span>
          </div>
        </button>
        {open && (
          <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">{userLabel}</div>
              <Link
                href="/account"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setOpen(false)}
              >
                My Account
              </Link>
              <button
                onClick={() => {
                  onSignOut();
                  setOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
