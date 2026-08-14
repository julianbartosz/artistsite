'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArtworkPiece } from '@/lib/portfolio';

export function PortfolioGallery({ artworks, categories }: { artworks: ArtworkPiece[]; categories: string[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const filteredArtworks = selectedCategory === 'all'
    ? artworks
    : artworks.filter((artwork) => artwork.category.includes(selectedCategory));

  return (
    <>
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            data-testid="filter-all"
            className={`px-3 py-1 text-sm rounded transition-colors ${selectedCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              data-testid={`filter-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              className={`px-3 py-1 text-sm rounded transition-colors ${selectedCategory === category ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {filteredArtworks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No artworks to display yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredArtworks.map((artwork) => (
            <div key={artwork.slug} className="group" data-testid="portfolio-item">
              <Link href={`/portfolio/${artwork.slug}`}>
                <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 mb-4">
                  <Image
                    src={artwork.images.thumbnail}
                    alt={artwork.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end">
                    <div className="p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-sm font-medium">{artwork.medium}</p>
                      <p className="text-xs">{artwork.dimensions}</p>
                    </div>
                  </div>
                  {artwork.featured && (
                    <div className="absolute top-3 left-3">
                      <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded font-medium">Featured</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${artwork.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {artwork.available ? 'Available' : 'Sold'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">{artwork.title}</h3>
                  <p className="text-gray-600 text-sm line-clamp-2">{artwork.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{artwork.year}</span>
                    {artwork.price && artwork.available && <span className="font-medium text-gray-900">{artwork.price}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {artwork.category.slice(0, 2).map((category) => (
                      <span key={category} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">{category}</span>
                    ))}
                    {artwork.category.length > 2 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">+{artwork.category.length - 2}</span>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default PortfolioGallery;