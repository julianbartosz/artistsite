'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useCart } from '@/components/CartContext';
import { CartDrawer } from '@/components/CartDrawer';
import type { SiteIdentityContent } from '@/lib/site-content-shared';
import { DEFAULT_SITE_IDENTITY, headerDisplayName, navItemIsActive, visibleNavItems } from '@/lib/site-content-shared';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';

type HeaderProps = {
  siteIdentity?: SiteIdentityContent;
};

export function Header({ siteIdentity = DEFAULT_SITE_IDENTITY }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const siteName = headerDisplayName(siteIdentity);
  const fullSiteName = siteIdentity.siteName;
  const pathname = usePathname();
  const { data: session } = useSession();
  const { state, toggleCart } = useCart();

  const navigation = visibleNavItems(siteIdentity);

  const isActive = (href: string) => navItemIsActive(pathname, href);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
    setIsUserMenuOpen(false);
  };

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMenuOpen]);

  return (
    <>
      <header className="relative group bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <CmsEditAnchor targetKey="identity:navigation" />
        <CmsEditAnchor targetKey="identity:branding" fixed />
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 h-16 min-w-0">
            {/* Logo/Brand */}
            <div className="min-w-0 flex-1">
              <Link href="/" className="flex items-center min-w-0">
                <span
                  className="truncate text-lg sm:text-2xl font-bold text-gray-900"
                  title={fullSiteName}
                >
                  {siteName}
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block flex-shrink-0">
              <div className="flex items-center gap-6">
                {navigation.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`px-1 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive(item.href)
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-gray-600 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2 md:gap-4">
              {session?.user?.isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                >
                  Studio
                </Link>
              )}
              {/* Authentication */}
              <div className="hidden md:block">
                {session ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      aria-label="Open user menu"
                      className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      <span className="sr-only">Open user menu</span>
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                        </span>
                      </div>
                    </button>
                    {isUserMenuOpen && (
                      <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                        <div className="py-1">
                          <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                            {session.user?.name || session.user?.email}
                          </div>
                          {session.user?.isAdmin && (
                            <Link
                              href="/admin"
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              Studio Dashboard
                            </Link>
                          )}
                          <Link
                            href="/account"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            My Account
                          </Link>
                          <button
                            onClick={handleSignOut}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Link
                      href="/auth/signin"
                      className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="btn-primary px-4 py-2 rounded-md text-sm"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>

              {/* Cart Icon */}
              <button
                onClick={toggleCart}
                data-testid="cart-icon"
                className="tap-target relative text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Open shopping cart"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 7H6L5 9z" />
                </svg>
                {state.itemCount > 0 && (
                  <span data-testid="cart-count" className="absolute -top-1 -right-1 bg-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {state.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu button */}
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-label="Open main menu"
                  data-testid="mobile-menu-toggle"
                  className="tap-target rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500"
                  aria-expanded={isMenuOpen}
                >
                  <span className="sr-only">Open main menu</span>
                  {!isMenuOpen ? (
                    <svg
                      className="block h-6 w-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="block h-6 w-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMenuOpen && (
            <div className="md:hidden" data-testid="mobile-menu">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
                {navigation.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`block tap-target-inline w-full text-left text-base font-medium transition-colors rounded-md ${
                      isActive(item.href)
                        ? 'text-gray-900 bg-gray-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                
                {/* Mobile Auth Section */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  {session ? (
                    <>
                      <div className="px-3 py-2 text-sm text-gray-500">
                        {session.user?.name || session.user?.email}
                      </div>
                      {session.user?.isAdmin && (
                        <Link
                          href="/admin"
                          className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Studio Dashboard
                        </Link>
                      )}
                      <Link
                        href="/account"
                        className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        My Account
                      </Link>
                      <button
                        onClick={() => {
                          handleSignOut();
                          setIsMenuOpen(false);
                        }}
                        className="block w-full text-left px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/signin"
                        className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/auth/signup"
                        className="block px-3 py-2 text-base font-medium btn-primary rounded-md mx-3 text-center"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Sign Up
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>
      
      {/* Cart Drawer */}
      <CartDrawer />
      
      {/* Click outside to close user menu */}
      {isUserMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsUserMenuOpen(false)}
        />
      )}
    </>
  );
}