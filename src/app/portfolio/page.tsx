import Link from 'next/link';
import Image from 'next/image';
import { getAllArtworks, getUniqueCategories, ArtworkPiece } from '@/lib/portfolio';

export default async function PortfolioPage() {
  const artworks = await getAllArtworks();
  const categories = getUniqueCategories(artworks);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Portfolio</h1>
        <p className="text-lg text-gray-600 max-w-2xl">
          A collection of paintings, drawings, and mixed media works exploring themes of 
          light, urban environments, and the intersection of abstraction and representation.
        </p>
      </div>

      {/* Category Filter */}
      <div className="mb-8">
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

      {/* Portfolio Grid */}
      {artworks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No artworks to display yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {artworks.map((artwork: ArtworkPiece) => (
            <div key={artwork.slug} className="group">
              <Link href={`/portfolio/${artwork.slug}`}>
                <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 mb-4">
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

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">
                    {artwork.title}
                  </h3>
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {artwork.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
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
  );
}