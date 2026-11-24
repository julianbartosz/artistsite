import { render, screen } from '@testing-library/react';
import BioPage from '@/app/bio/page';
import { getSiteContent } from '@/lib/site-content';
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

const mockGetSiteContent = getSiteContent as jest.MockedFunction<typeof getSiteContent>;

describe('Bio Page', () => {
  beforeEach(() => {
    mockGetSiteContent.mockImplementation(
      async (page: string) => SITE_CONTENT_DEFAULTS[page as keyof typeof SITE_CONTENT_DEFAULTS] as never,
    );
  });

  it('renders CMS-driven hero content and omits duplicate closing CTA when no bio body exists', async () => {
    const page = await BioPage();
    render(page);

    expect(screen.getByRole('heading', { level: 1, name: SITE_CONTENT_DEFAULTS.bio.hero.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: SITE_CONTENT_DEFAULTS.bio.hero.ctaPortfolio })).toHaveAttribute('href', '/portfolio');
    expect(screen.getByRole('link', { name: SITE_CONTENT_DEFAULTS.bio.hero.ctaContact })).toHaveAttribute('href', '/contact');
    expect(screen.queryByRole('heading', { level: 2, name: SITE_CONTENT_DEFAULTS.bio.cta.title })).not.toBeInTheDocument();
  });

  it('renders the closing CTA once bio body content is present', async () => {
    mockGetSiteContent.mockResolvedValueOnce({
      ...SITE_CONTENT_DEFAULTS.bio,
      artistStatementHtml: '<p>Working with oil and cold wax on linen.</p>',
    } as never);

    const page = await BioPage();
    render(page);

    expect(screen.getByRole('heading', { level: 2, name: SITE_CONTENT_DEFAULTS.bio.statementTitle })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: SITE_CONTENT_DEFAULTS.bio.cta.title })).toBeInTheDocument();
  });

  it('preserves multi-paragraph breaks in the bio intro text', async () => {
    mockGetSiteContent.mockResolvedValueOnce({
      ...SITE_CONTENT_DEFAULTS.bio,
      hero: {
        ...SITE_CONTENT_DEFAULTS.bio.hero,
        subtitle: 'First studio paragraph.\n\nSecond studio paragraph.',
      },
    } as never);

    const page = await BioPage();
    render(page);

    expect(screen.getByText('First studio paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Second studio paragraph.')).toBeInTheDocument();
  });
});
