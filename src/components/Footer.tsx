'use client';

import React from 'react';
import Link from 'next/link';
import type { SiteFooterContent, SiteIdentityContent } from '@/lib/site-content-shared';
import { DEFAULT_SITE_IDENTITY, footerNavItems } from '@/lib/site-content-shared';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';

const DEFAULT_FOOTER = DEFAULT_SITE_IDENTITY.footer;

type FooterProps = {
  siteIdentity?: SiteIdentityContent;
  footerContent?: SiteFooterContent;
  contactEmail?: string;
  socialUrls?: {
    instagram: string;
    facebook: string;
    twitter: string;
    pinterest: string;
  };
};

export function Footer({
  siteIdentity = DEFAULT_SITE_IDENTITY,
  footerContent = DEFAULT_FOOTER,
  contactEmail = '',
  socialUrls = { instagram: '', facebook: '', twitter: '', pinterest: '' },
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    main: footerNavItems(siteIdentity),
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
    social: [
      socialUrls.instagram ? { name: 'Instagram', href: socialUrls.instagram, icon: 'instagram' } : null,
      socialUrls.facebook ? { name: 'Facebook', href: socialUrls.facebook, icon: 'facebook' } : null,
      socialUrls.twitter ? { name: 'X', href: socialUrls.twitter, icon: 'twitter' } : null,
      socialUrls.pinterest ? { name: 'Pinterest', href: socialUrls.pinterest, icon: 'pinterest' } : null,
      contactEmail
        ? { name: 'Email', href: `mailto:${contactEmail}`, icon: 'email' }
        : { name: 'Contact', href: '/contact', icon: 'email' },
    ].filter(Boolean) as Array<{ name: string; href: string; icon: string }>,
  };

  const extraColumn = footerContent.extraColumn;
  const showExtraColumn = extraColumn.show && (extraColumn.heading.trim() || extraColumn.bodyHtml.trim());
  const linkColumnCount = [
    footerLinks.main.length > 0,
    footerContent.showLegal,
    showExtraColumn,
  ].filter(Boolean).length;

  const SocialIcon = ({ icon }: { icon: string }) => {
    switch (icon) {
      case 'instagram':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z" />
          </svg>
        );
      case 'twitter':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
          </svg>
        );
      case 'facebook':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22 12.06C22 6.48 17.52 2 11.94 2S2 6.48 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.79-3.91 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.9h2.77l-.44 2.91h-2.33V22c4.78-.76 8.42-4.92 8.42-9.94z" />
          </svg>
        );
      case 'pinterest':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.02 2C6.49 2 3 5.72 3 9.77c0 1.88 1.05 4.23 2.73 4.97.25.11.38.06.44-.18.04-.18.26-1.05.36-1.45.03-.13.02-.25-.09-.38-.55-.67-.99-1.91-.99-3.06 0-2.84 2.15-5.59 5.82-5.59 3.17 0 5.39 2.16 5.39 5.25 0 3.49-1.76 5.91-4.05 5.91-1.26 0-2.2-1.04-1.9-2.32.36-1.52 1.06-3.16 1.06-4.25 0-.98-.53-1.8-1.62-1.8-1.28 0-2.31 1.33-2.31 3.11 0 1.13.38 1.9.38 1.9s-1.27 5.39-1.5 6.39c-.26 1.12-.16 2.69-.05 3.72.03.31.41.42.58.16.27-.38 1.16-1.7 1.45-2.78.1-.39.56-2.14.56-2.14.3.57 1.17 1.05 2.1 1.05 2.76 0 4.75-2.54 4.75-5.7 0-3.03-2.47-5.3-5.64-5.3z" />
          </svg>
        );
      case 'email':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const linkGridClass = linkColumnCount >= 3
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8'
    : linkColumnCount === 2
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8'
      : 'grid grid-cols-1 gap-y-8';

  return (
    <footer className="relative group bg-primary text-white" role="contentinfo">
      <CmsEditAnchor targetKey="identity:footer" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">{siteIdentity.siteName}</h3>
            <p className="text-gray-300 mb-5 sm:mb-6 text-sm sm:text-base leading-relaxed">
              {siteIdentity.tagline}
            </p>
            <div className="flex flex-wrap gap-2">
              {footerLinks.social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="tap-target rounded-md text-gray-400 hover:text-white transition-colors"
                  aria-label={item.name}
                >
                  <SocialIcon icon={item.icon} />
                </a>
              ))}
            </div>
          </div>

          {linkColumnCount > 0 && (
            <div className={`md:col-span-7 ${linkGridClass}`}>
              {footerLinks.main.length > 0 && (
                <div className="min-w-0">
                  <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{footerContent.quickLinksHeading}</h4>
                  <ul className="space-y-2">
                    {footerLinks.main.map((item) => (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          className="tap-target-inline text-sm sm:text-base text-gray-300 hover:text-white transition-colors rounded-md"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {footerContent.showLegal && (
                <div className="min-w-0">
                  <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{footerContent.legalHeading}</h4>
                  <ul className="space-y-2">
                    {footerLinks.legal.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className="tap-target-inline text-sm sm:text-base text-gray-300 hover:text-white transition-colors rounded-md"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {showExtraColumn && (
                <div className="min-w-0">
                  {extraColumn.heading.trim() && (
                    <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{extraColumn.heading}</h4>
                  )}
                  {extraColumn.bodyHtml.trim() && (
                    <div
                      className="prose prose-invert prose-sm max-w-none text-gray-300"
                      dangerouslySetInnerHTML={{ __html: extraColumn.bodyHtml }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 flex flex-row flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <p className="text-gray-400 text-sm">
            © {currentYear} {siteIdentity.copyrightName}. All rights reserved.
          </p>
          <p className="text-gray-400 text-sm max-w-md text-left sm:text-right leading-relaxed">
            {siteIdentity.footerTagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
