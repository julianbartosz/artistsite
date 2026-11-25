import type { Metadata } from 'next';
import { getAllArtworks, getUniqueCategories } from '@/lib/portfolio';
import { getSiteContent, listingHeroPaddingClass } from '@/lib/site-content';
import { resolvePortfolioFilterCategories } from '@/lib/site-content-shared';
import PortfolioGallery from '@/components/PortfolioGallery';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const portfolio = await getSiteContent('portfolio');
  return {
    title: portfolio.title || 'Portfolio',
    description: portfolio.subtitle || undefined,
    openGraph: {
      title: portfolio.title || 'Portfolio',
      description: portfolio.subtitle || undefined,
      type: 'website',
    },
    alternates: { canonical: '/portfolio' },
  };
}

type PortfolioSearch = {
  category?: string | string[];
};

function firstParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<PortfolioSearch>;
}) {
  const params = await searchParams;
  const [artworks, pageContent] = await Promise.all([
    getAllArtworks(),
    getSiteContent('portfolio'),
  ]);
  const categories = resolvePortfolioFilterCategories(
    getUniqueCategories(artworks),
    pageContent.categories,
    { includeUnlisted: pageContent.layout.includeUnlistedCategories },
  );
  const requestedCategory = firstParam(params.category);
  const selectedCategory = categories.some(
    (category) => category.key.toLowerCase() === requestedCategory.toLowerCase(),
  )
    ? (categories.find((category) => category.key.toLowerCase() === requestedCategory.toLowerCase())?.key
      ?? requestedCategory)
    : 'all';
  const heroPadding = listingHeroPaddingClass(pageContent.hero.height);
  const subtitle = pageContent.subtitle.trim();

  return (
    <div className="min-h-screen bg-surface-muted">
      <section className="relative group bg-surface shadow-sm">
        <CmsEditAnchor targetKey="portfolio:listing" />
        <div className={`max-w-7xl mx-auto px-6 ${heroPadding}`}>
          <div className="text-center">
            <h1 className={`text-3xl md:text-4xl font-bold text-gray-900 ${subtitle ? 'mb-4' : ''}`}>{pageContent.title}</h1>
            {subtitle ? (
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-10 md:py-12">
        <PortfolioGallery
          artworks={artworks}
          categories={categories}
          selectedCategory={selectedCategory}
          layout={pageContent.layout}
        />
      </div>
    </div>
  );
}
