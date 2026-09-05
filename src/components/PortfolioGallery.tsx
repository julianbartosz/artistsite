'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArtworkPiece } from '@/lib/portfolio';
import type { PortfolioPageContent } from '@/lib/site-content-shared';

type PortfolioLayout = PortfolioPageContent['layout'];

const GRID_CLASS: Record<PortfolioLayout['gridColumns'], string> = {
  '2': 'grid grid-cols-1 md:grid-cols-2 gap-8',
  '3': 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8',
  '4': 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6',
};

const MASONRY_CLASS: Record<PortfolioLayout['gridColumns'], string> = {
  '2': 'columns-1 md:columns-2 gap-8',
  '3': 'columns-1 md:columns-2 lg:columns-3 gap-8',
  '4': 'columns-1 sm:columns-2 lg:columns-4 gap-6',
};

export function PortfolioGallery({
  artworks,
  categories,
  layout = { gridColumns: '3', showFilters: true, masonry: false },
}: {
  artworks: ArtworkPiece[];
  categories: string[];
  layout?: PortfolioLayout;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const filteredArtworks = selectedCategory === 'all'
    ? artworks
    : artworks.filter((artwork) => artwork.category.includes(selectedCategory));

  const containerClass = layout.masonry ? MASONRY_CLASS[layout.gridColumns] : GRID_CLASS[layout.gridColumns];
  const itemClass = layout.masonry ? 'break-inside-avoid mb-8' : '';

  return (
    <>
      {layout.showFilters && (
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            data-testid="filter-all"
            className={`px-3 py-1 text-sm rounded transition-colors ${selectedCategory === 'all' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              data-testid={`filter-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              className={`px-3 py-1 text-sm rounded transition-colors ${selectedCategory === category ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      )}

      {filteredArtworks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No artworks to display yet.</p>
        </div>
      ) : (
        <div className={containerClass}>
          {filteredArtworks.map((artwork) => (
            <div key={artwork.slug} className={`group ${itemClass}`} data-testid="portfolio-item">
              <Link href={`/portfolio/${artwork.slug}`}>
                <div className={`relative overflow-hidden rounded-lg bg-gray-100 mb-4 ${layout.masonry ? 'aspect-[4/5]' : 'aspect-square'}`}>
                  <Image
                    src={artwork.images.thumbnail}
                    alt={artwork.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transform-none"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
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
                  <h3 className="text-lg font-semibold group-hover:text-gray-700 transition-colors">{artwork.title}</h3>
                  {(artwork.medium || artwork.dimensions) && (
                    <p className="text-sm text-gray-600">
                      {[artwork.medium, artwork.dimensions].filter(Boolean).join(' · ')}
                    </p>
                  )}
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
