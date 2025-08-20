import Link from 'next/link';
import Image from 'next/image';
import { getAllArtworks, getUniqueCategories, ArtworkPiece } from '@domain/content';
import { IconImage } from '@ui/icons';

export default async function PortfolioPage() {
  const artworks = await getAllArtworks();
  const categories = getUniqueCategories(artworks);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section - Matching site theme */}
      <section className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Portfolio</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A collection of paintings, drawings, and mixed media works exploring themes of 
              light, urban environments, and the intersection of abstraction and representation.
            </p>
          </div>
          
          {/* Category Filter */}
          <div className="flex justify-center">
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-gray-900 text-white text-sm rounded">
                All
              </span>
              {categories.map((category) => (
                <button
                  key={category}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded transition-colors"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Grid - Matching container width */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          {artworks.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 mb-4">
                <IconImage className="mx-auto h-12 w-12" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No artworks to display yet</h3>
              <p className="text-gray-600">Check back soon for new works!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {artworks.map((artwork: ArtworkPiece) => (
                <div key={artwork.slug} className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  <Link href={`/portfolio/${artwork.slug}`}>
                    <div className="relative aspect-square overflow-hidden bg-gray-100">
                      <Image
                        src={artwork.images.thumbnail}
                        alt={artwork.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      
                      {/* Overlay with artwork info */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end">
                        <div className="p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <p className="text-sm font-medium">{artwork.medium}</p>
                          <p className="text-xs">{artwork.dimensions}</p>
                        </div>
                      </div>

                      {/* Featured badge */}
                      {artwork.featured && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded font-medium">
                            Featured
                          </span>
                        </div>
                      )}

                      {/* Availability status */}
                      <div className="absolute top-3 right-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          artwork.available 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {artwork.available ? 'Available' : 'Sold'}
                        </span>
                      </div>
                    </div>

                    {/* Product Info - Matching shop card style */}
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {artwork.title}
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                        {artwork.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                        <span>{artwork.year}</span>
                        {artwork.price && artwork.available && (
                          <span className="font-medium text-gray-900">{artwork.price}</span>
                        )}
                      </div>
                      
                      {/* Categories */}
                      <div className="flex flex-wrap gap-1">
                        {artwork.category.slice(0, 2).map((cat) => (
                          <span 
                            key={cat}
                            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                          >
                            {cat}
                          </span>
                        ))}
                        {artwork.category.length > 2 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            +{artwork.category.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Info Section - Adding consistent footer like shop page */}
      <section className="bg-white py-16 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">About the Portfolio</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Original Works</h3>
              <p className="text-gray-600">
                Each piece is an original artwork, carefully crafted with attention to detail and artistic vision.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Available for Purchase</h3>
              <p className="text-gray-600">
                Many works are available for purchase. Visit the shop or contact me for pricing and availability.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Commission Work</h3>
              <p className="text-gray-600">
                Interested in a custom piece? I accept commissions for paintings and drawings.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <Link
              href="/contact"
              className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Contact for Inquiries
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}