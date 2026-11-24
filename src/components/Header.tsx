'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
  const userMenuRef = useRef<HTMLDivElement>(null);
  const siteName = headerDisplayName(siteIdentity);
  const fullSiteName = siteIdentity.siteName;
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { state, toggleCart } = useCart();

  const navigation = visibleNavItems(siteIdentity);
  const isAuthLoading = status === 'loading';

  const isActive = (href: string) => navItemIsActive(pathname, href);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
    setIsUserMenuOpen(false);
  };

  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isUserMenuOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMenuOpen]);

  const userInitial = (
    session?.user?.name?.trim().charAt(0)
    || session?.user?.email?.trim().charAt(0)
    || 'U'
  ).toUpperCase();

  return (
    <>
      <header className="relative group bg-surface shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <CmsEditAnchor targetKey="identity:navigation" />
        <CmsEditAnchor targetKey="identity:branding" fixed />
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16 min-w-0">
            {/* Logo/Brand */}
            <div className="min-w-0 flex-1">
              <Link href="/" className="flex items-center min-w-0">
                {siteIdentity.logoImage ? (
                  <img
                    src={siteIdentity.logoImage}
                    alt={fullSiteName}
                    className="h-9 sm:h-11 w-auto max-w-[min(14rem,60vw)] object-contain object-left"
                  />
                ) : (
                  <span
                    className="truncate font-heading text-lg sm:text-2xl font-bold text-gray-900"
                    title={fullSiteName}
                  >
                    {siteName}
                  </span>
                )}
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:block flex-shrink-0">
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

            {/* Right side utility actions */}
            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
              {session?.user?.isAdmin && (
                <Link
                  href="/admin"
                  className="hidden lg:inline-flex items-center rounded-full border border-gray-200 bg-surface-muted px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 mr-1"
                >
                  Studio
                </Link>
              )}

              {/* Account action (desktop): direct link to Sign in when signed out; menu when signed in */}
              <div className="hidden lg:block relative" ref={userMenuRef}>
                {session ? (
                  <>
                    <button
                      type="button"
                      disabled={isAuthLoading}
                      onClick={() => setIsUserMenuOpen((open) => !open)}
                      aria-label="Open user menu"
                      aria-expanded={isUserMenuOpen}
                      aria-haspopup="menu"
                      data-testid="account-menu-button"
                      className="tap-target rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary disabled:opacity-40"
                    >
                      <span className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-white">
                        {userInitial}
                      </span>
                    </button>

                    {isUserMenuOpen && !isAuthLoading && (
                      <div
                        role="menu"
                        aria-label="Account menu"
                        className="origin-top-right absolute right-0 mt-2 w-52 rounded-lg shadow-lg bg-surface border border-gray-200 py-1.5 z-50"
                      >
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {session.user?.name || session.user?.email}
                          </p>
                          {session.user?.name && session.user?.email && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {session.user.email}
                            </p>
                          )}
                        </div>
                        {session.user?.isAdmin ? (
                          <Link
                            href="/admin"
                            role="menuitem"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            Studio
                          </Link>
                        ) : (
                          <Link
                            href="/account"
                            role="menuitem"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            My Account
                          </Link>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleSignOut}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                        >
                          Sign out
                        </button>
                      </div>
                    )}
                  </>
                ) : isAuthLoading ? (
                  <button
                    type="button"
                    disabled
                    aria-label="Account"
                    data-testid="account-menu-button"
                    className="tap-target rounded-lg text-gray-600 transition-colors disabled:opacity-40"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z"
                      />
                    </svg>
                  </button>
                ) : (
                  <Link
                    href="/auth/signin"
                    aria-label="Sign in"
                    title="Sign in"
                    data-testid="account-menu-button"
                    className="tap-target rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z"
                      />
                    </svg>
                  </Link>
                )}
              </div>

              {/* Cart Icon */}
              <button
                type="button"
                onClick={toggleCart}
                data-testid="cart-icon"
                className="tap-target relative text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Open shopping cart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 7H6L5 9z" />
                </svg>
                {state.itemCount > 0 && (
                  <span data-testid="cart-count" className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[11px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {state.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu button */}
              <div className="lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-label={isMenuOpen ? 'Close main menu' : 'Open main menu'}
                  data-testid="mobile-menu-toggle"
                  className="tap-target rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500"
                  aria-expanded={isMenuOpen}
                >
                  <span className="sr-only">{isMenuOpen ? 'Close main menu' : 'Open main menu'}</span>
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
            <div className="lg:hidden" data-testid="mobile-menu">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
                {navigation.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`block tap-target-inline w-full text-left text-base font-medium transition-colors rounded-md ${
                      isActive(item.href)
                        ? 'text-primary bg-primary/5'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}

                {/* Mobile Auth Section */}
                {!isAuthLoading && (
                  <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                    {session ? (
                      <>
                        <div className="px-3 py-1.5 text-xs text-gray-500 truncate">
                          {session.user?.name || session.user?.email}
                        </div>
                        {session.user?.isAdmin ? (
                          <Link
                            href="/admin"
                            className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            Studio
                          </Link>
                        ) : (
                          <Link
                            href="/account"
                            className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            My Account
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            handleSignOut();
                            setIsMenuOpen(false);
                          }}
                          className="block w-full rounded-md text-left px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        >
                          Sign out
                        </button>
                      </>
                    ) : (
                      <Link
                        href="/auth/signin"
                        className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Sign in
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Cart Drawer */}
      <CartDrawer />
    </>
  );
}