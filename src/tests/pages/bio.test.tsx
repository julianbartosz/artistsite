import { render, screen } from '@testing-library/react';
import BioPage from '@/app/bio/page';
import { SITE_CONTENT_DEFAULTS } from '@/lib/site-content-shared';

jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    const { fill, priority, sizes, ...cleanProps } = props;
    return <img src={src} alt={alt} {...cleanProps} />;
  };
});

jest.mock('next/link', () => {
  return function MockLink({ href, children, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock('@/lib/site-content', () => ({
  getSiteContent: jest.fn(async (page: string) => SITE_CONTENT_DEFAULTS[page as keyof typeof SITE_CONTENT_DEFAULTS]),
}));

describe('Bio Page', () => {
  it('renders CMS-driven hero content', async () => {
    const page = await BioPage();
    render(page);

    expect(screen.getByRole('heading', { level: 1, name: SITE_CONTENT_DEFAULTS.bio.hero.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: SITE_CONTENT_DEFAULTS.bio.hero.ctaPortfolio })).toHaveAttribute('href', '/portfolio');
    expect(screen.getByRole('link', { name: SITE_CONTENT_DEFAULTS.bio.hero.ctaContact })).toHaveAttribute('href', '/contact');
  });
});
