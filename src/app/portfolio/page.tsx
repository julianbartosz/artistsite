import { getAllArtworks, getUniqueCategories } from '@/lib/portfolio';
import { getSiteContent, listingHeroPaddingClass } from '@/lib/site-content';
import PortfolioGallery from '@/components/PortfolioGallery';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const [artworks, pageContent] = await Promise.all([
    getAllArtworks(),
    getSiteContent('portfolio'),
  ]);
  const categories = getUniqueCategories(artworks);
  const heroPadding = listingHeroPaddingClass(pageContent.hero.height);

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative group bg-white shadow-sm">
        <CmsEditAnchor targetKey="portfolio:listing" />
        <div className={`max-w-7xl mx-auto px-6 ${heroPadding}`}>
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{pageContent.title}</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">{pageContent.subtitle}</p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-10 md:py-12">
        <PortfolioGallery artworks={artworks} categories={categories} layout={pageContent.layout} />
      </div>
    </div>
  );
}
