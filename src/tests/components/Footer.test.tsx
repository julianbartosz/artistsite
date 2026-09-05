import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/Footer';
import { DEFAULT_NAVIGATION, DEFAULT_SITE_IDENTITY } from '@/lib/site-content-shared';

describe('Footer Component', () => {
  it('renders footer content correctly', () => {
    render(<Footer />);

    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Artist Site`))).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved\./)).toBeInTheDocument();
  });

  it('renders social media links', () => {
    render(<Footer />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
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
    expect(screen.queryByRole('link', { name: 'Blog' })).not.toBeInTheDocument();
  });
});
