'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ArtworkPiece } from '@/lib/portfolio';
import { artworkGalleryImages } from '@/lib/commerce';
import ImageCarousel from '@/components/ImageCarousel';
import {
  normalizePortfolioCategoryKey,
  type PortfolioPageContent,
} from '@/lib/site-content-shared';

/** Above this, a select stays quieter than a wrapping link row on small screens. */
const INLINE_CATEGORY_LIMIT = 6;

type PortfolioLayout = PortfolioPageContent['layout'];
type PortfolioFilterCategory = { key: string; label: string };

const GRID_CLASS: Record<PortfolioLayout['gridColumns'], string> = {
  '2': 'grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10',
  '3': 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10',
  '4': 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8',
};

const MASONRY_CLASS: Record<PortfolioLayout['gridColumns'], string> = {
  '2': 'columns-1 md:columns-2 gap-8 md:gap-10',
  '3': 'columns-1 md:columns-2 lg:columns-3 gap-8 md:gap-10',
  '4': 'columns-1 sm:columns-2 lg:columns-4 gap-6 md:gap-8',
};

const ASPECT_CLASS: Record<PortfolioLayout['thumbAspect'], string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[3/2]',
};

function portfolioCategoryHref(category: string | 'all'): string {
  if (category === 'all') return '/portfolio';
  return `/portfolio?category=${encodeURIComponent(category)}`;
}

function thumbAspectClass(layout: PortfolioLayout): string {
  if (layout.masonry) return ASPECT_CLASS.portrait;
  return ASPECT_CLASS[layout.thumbAspect];
}

function imageFitClass(layout: PortfolioLayout): string {
  return layout.imageFit === 'contain' ? 'object-contain' : 'object-cover';
}

function PortfolioArtworkCard({
  artwork,
  layout,
  priority = false,
}: {
  artwork: ArtworkPiece;
  layout: PortfolioLayout;
  priority?: boolean;
}) {
  const artworkHref = `/portfolio/${artwork.slug}`;
  const galleryImages = artworkGalleryImages(artwork.images);
  const meta = [artwork.medium, artwork.dimensions, artwork.year].filter(Boolean).join(' · ');

  return (
    <article data-testid="portfolio-item" className="group">
      <ImageCarousel
        images={galleryImages}
        alt={artwork.title}
        href={artworkHref}
        variantSize="md"
        priority={priority}
        className={`relative overflow-hidden bg-gray-100 ${thumbAspectClass(layout)}`}
        imageClassName={`${imageFitClass(layout)} transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none`}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      >
        {layout.showFeaturedBadge && artwork.featured && (
          <span className="pointer-events-none absolute left-3 top-3 z-20 bg-black/70 px-2 py-1 text-xs font-medium text-white">
            Featured
          </span>
        )}
        {layout.showSoldBadge && !artwork.available && (
          <span className="pointer-events-none absolute right-3 top-3 z-20 bg-white/95 px-2 py-1 text-xs font-medium text-gray-900">
            Not available
          </span>
        )}
      </ImageCarousel>

      <Link href={artworkHref} className="block space-y-1 pt-3">
        <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-gray-700">
          {artwork.title}
        </h3>
        {layout.showMeta && meta && <p className="text-sm text-gray-600">{meta}</p>}
        {layout.showPrice && artwork.price && artwork.available && (
          <p className="text-sm font-medium text-gray-900">{artwork.price}</p>
        )}
      </Link>
    </article>
  );
}

function filterLinkClass(active: boolean): string {
  return [
    'tap-target-inline shrink-0 border-b text-sm tracking-wide transition-colors',
    active
      ? 'border-gray-900 font-medium text-gray-900'
      : 'border-transparent text-gray-500 hover:text-gray-900',
  ].join(' ');
}

const DEFAULT_LAYOUT: PortfolioLayout = {
  gridColumns: '3',
  showFilters: true,
  masonry: false,
  imageFit: 'cover',
  thumbAspect: 'square',
  showFeaturedBadge: true,
  showSoldBadge: false,
  showMeta: true,
  showPrice: false,
  includeUnlistedCategories: false,
};

export function PortfolioGallery({
  artworks,
  categories,
  selectedCategory = 'all',
  layout = DEFAULT_LAYOUT,
}: {
  artworks: ArtworkPiece[];
  categories: PortfolioFilterCategory[];
  selectedCategory?: string;
  layout?: PortfolioLayout;
}) {
  const router = useRouter();
  const categoryKeys = categories.map((category) => category.key);
  const activeCategory = selectedCategory === 'all' || categoryKeys.includes(selectedCategory)
    ? selectedCategory
    : 'all';
  const activeCategoryKey = activeCategory === 'all'
    ? 'all'
    : normalizePortfolioCategoryKey(activeCategory);
  const filteredArtworks = activeCategory === 'all'
    ? artworks
    : artworks.filter((artwork) => artwork.category.some(
      (category) => normalizePortfolioCategoryKey(category) === activeCategoryKey,
    ));

  const containerClass = layout.masonry ? MASONRY_CLASS[layout.gridColumns] : GRID_CLASS[layout.gridColumns];
  const itemClass = layout.masonry ? 'break-inside-avoid mb-8' : '';
  const showFilters = layout.showFilters && categories.length > 0;
  const useSelect = categories.length > INLINE_CATEGORY_LIMIT;
  const activeLabel = categories.find((category) => category.key === activeCategory)?.label
    ?? activeCategory;

  return (
    <>
      {showFilters && (
        useSelect ? (
          <div className="mb-10 flex justify-center md:mb-12">
            <label className="inline-flex items-center gap-3 text-sm text-gray-600">
              <span className="shrink-0">Category</span>
              <select
                data-testid="filter-all"
                aria-label="Portfolio categories"
                value={activeCategory}
                onChange={(event) => {
                  router.push(portfolioCategoryHref(event.target.value), { scroll: false });
                }}
                className="min-w-[12rem] border-0 border-b border-gray-300 bg-transparent py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
              >
                <option value="all">All works</option>
                {categories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <nav
            className="mb-10 flex flex-wrap items-baseline justify-center gap-x-5 gap-y-3 md:mb-12"
            aria-label="Portfolio categories"
          >
            <Link
              href={portfolioCategoryHref('all')}
              data-testid="filter-all"
              aria-current={activeCategory === 'all' ? 'page' : undefined}
              className={filterLinkClass(activeCategory === 'all')}
            >
              All
            </Link>
            {categories.map((category) => {
              const active = activeCategory === category.key;
              return (
                <Link
                  key={category.key}
                  href={portfolioCategoryHref(category.key)}
                  data-testid={`filter-${category.key}`}
                  aria-current={active ? 'page' : undefined}
                  className={filterLinkClass(active)}
                >
                  {category.label}
                </Link>
              );
            })}
          </nav>
        )
      )}

      {filteredArtworks.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-lg text-gray-500">
            {activeCategory === 'all'
              ? 'No artworks to display yet.'
              : `No works in ${activeLabel} yet.`}
          </p>
          {activeCategory === 'all' ? (
            <Link href="/contact" className="mt-3 inline-block text-sm font-medium text-gray-900 underline-offset-4 hover:underline">
              Contact the studio
            </Link>
          ) : (
            <Link href="/portfolio" className="mt-3 inline-block text-sm font-medium text-gray-900 underline-offset-4 hover:underline">
              View all works
            </Link>
          )}
        </div>
      ) : (
        <div className={containerClass}>
          {filteredArtworks.map((artwork, index) => (
            <div key={artwork.slug} className={itemClass}>
              <PortfolioArtworkCard artwork={artwork} layout={layout} priority={index < 3} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default PortfolioGallery;
