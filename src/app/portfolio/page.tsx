import { getAllArtworks, getUniqueCategories } from '@/lib/portfolio';
import PortfolioGallery from '@/components/PortfolioGallery';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const artworks = await getAllArtworks();
  const categories = getUniqueCategories(artworks);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <section className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Portfolio</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A collection of paintings, drawings, and mixed media works exploring themes of
              light, urban environments, and the intersection of abstraction and representation.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <PortfolioGallery artworks={artworks} categories={categories} />
      </div>
    </div>
  );
}