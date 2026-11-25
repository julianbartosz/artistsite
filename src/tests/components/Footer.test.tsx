import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/Footer';
import {
  DEFAULT_NAVIGATION,
  DEFAULT_SITE_IDENTITY,
  instagramProfileHref,
  isMeaningfulSiteText,
  normalizeNavigation,
  safeExternalHref,
} from '@/lib/site-content-shared';
import { createCollectorFeedToken, verifyCollectorFeedToken } from '@/lib/collector-feed-token';

describe('Footer Component', () => {
  it('renders footer content correctly', () => {
    render(<Footer />);

    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Michal Elena`))).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved\./)).toBeInTheDocument();
  });

  it('renders social media links', () => {
    render(<Footer />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
  });

  it('links to contact when no studio email is configured', () => {
    render(<Footer contactEmail="" />);
    const socialContact = screen.getAllByRole('link', { name: 'Contact' }).find((link) => link.getAttribute('href') === '/contact' && link.querySelector('svg'));
    expect(socialContact).toBeTruthy();
  });

  it('uses mailto when a studio email is configured', () => {
    render(<Footer contactEmail="studio@example.com" />);
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:studio@example.com');
  });

  it('has correct styling classes', () => {
    render(<Footer />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('bg-primary', 'text-white');
  });

  it('uses artist-configured footer links and visibility', () => {
    render(
      <Footer
        siteIdentity={{
          ...DEFAULT_SITE_IDENTITY,
          navigation: DEFAULT_NAVIGATION.map((item) => {
            if (item.key === 'shop') return { ...item, visible: true, showInFooter: true, label: 'Store' };
            if (item.key === 'blog') return { ...item, visible: true, showInFooter: false };
            return { ...item, showInFooter: false };
          }),
        }}
      />
    );

    expect(screen.getByRole('link', { name: 'Store' })).toHaveAttribute('href', '/shop');
    expect(screen.queryByRole('link', { name: 'Updates' })).not.toBeInTheDocument();
  });

  it('migrates legacy Blog nav label to Updates', () => {
    const navigation = normalizeNavigation(
      DEFAULT_NAVIGATION.map((item) => item.key === 'blog' ? { ...item, label: 'Blog' } : item),
    );
    const blogItem = navigation.find((item) => item.key === 'blog');
    expect(blogItem?.label).toBe('Updates');
    expect(blogItem?.href).toBe('/updates');
  });

  it('renders only safe external social links with noopener noreferrer', () => {
    render(
      <Footer
        socialUrls={{
          instagram: 'https://instagram.com/studio',
          facebook: 'javascript:alert(1)',
          twitter: 'https://x.com/studio',
          pinterest: 'data:text/html,evil',
        }}
      />
    );

    const instagram = screen.getByRole('link', { name: 'Instagram' });
    expect(instagram).toHaveAttribute('href', 'https://instagram.com/studio');
    expect(instagram).toHaveAttribute('target', '_blank');
    expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pinterest' })).not.toBeInTheDocument();
  });

  it('validates short CMS values and external URLs safely', () => {
    expect(isMeaningfulSiteText('2')).toBe(true);
    expect(isMeaningfulSiteText('4')).toBe(true);
    expect(isMeaningfulSiteText('ME')).toBe(true);
    expect(isMeaningfulSiteText('Untitled')).toBe(false);
    expect(isMeaningfulSiteText('placeholder')).toBe(false);
    expect(isMeaningfulSiteText('   ')).toBe(false);

    expect(safeExternalHref('https://example.com/art')).toBe('https://example.com/art');
    expect(safeExternalHref('javascript:alert(1)')).toBeNull();
    expect(instagramProfileHref('@michalelenaart')).toBe('https://www.instagram.com/michalelenaart/');
    expect(instagramProfileHref('https://www.instagram.com/michalelenaart/')).toBe('https://www.instagram.com/michalelenaart/');
    expect(instagramProfileHref('javascript:alert(1)')).toBeNull();
  });

  it('places Quick Links and Legal side-by-side on mobile to keep the footer compact', () => {
    render(<Footer />);

    const quickLinksHeading = screen.getByRole('heading', { name: 'Quick Links' });
    const legalHeading = screen.getByRole('heading', { name: 'Legal' });
    const linkGrid = quickLinksHeading.parentElement?.parentElement;
    expect(linkGrid).toBe(legalHeading.parentElement?.parentElement);
    expect(linkGrid).toHaveClass('grid', 'grid-cols-2');
  });

  it('creates and verifies collector feed tokens', async () => {
    const previous = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = 'test-feed-secret';
    try {
      const token = await createCollectorFeedToken('user-123');
      const userId = await verifyCollectorFeedToken(token);
      expect(userId).toBe('user-123');
      expect(await verifyCollectorFeedToken('invalid.token')).toBeNull();
      expect(await verifyCollectorFeedToken(await createCollectorFeedToken('user-123', Date.now() - 1000))).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.NEXTAUTH_SECRET;
      else process.env.NEXTAUTH_SECRET = previous;
    }
  });

  it('fails closed when collector feed secret is missing', async () => {
    const previousAuth = process.env.NEXTAUTH_SECRET;
    const previousAlt = process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
    try {
      await expect(createCollectorFeedToken('user-123')).rejects.toThrow(/NEXTAUTH_SECRET|AUTH_SECRET/);
      expect(await verifyCollectorFeedToken('anything.here')).toBeNull();
    } finally {
      if (previousAuth === undefined) delete process.env.NEXTAUTH_SECRET;
      else process.env.NEXTAUTH_SECRET = previousAuth;
      if (previousAlt === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previousAlt;
    }
  });
});
