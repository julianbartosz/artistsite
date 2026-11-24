'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SearchResults, SortOption } from '@/lib/types';
import SearchBar from '@/components/SearchBar';
import FilterSidebar from '@/components/FilterSidebar';
import ProductRecommendations from '@/components/ProductRecommendations';
import RecentlyViewed from '@/components/RecentlyViewed';
import { stableSearchParamsKey, activeFilterCount, activeFilterChips, removeFilterChip } from '@/lib/search-params';
import { ShopProductCard } from '@/components/ProductCard';
import { DEFAULT_SHOP_PAGE, QUIET_SHOP_CATALOG_LIMIT, gridColumnsClass, listingHeroPaddingClass, type ShopPageContent } from '@/lib/site-content-shared';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_low_high', label: 'Price: Low to High' },
  { value: 'price_high_low', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'popularity', label: 'Most Popular' },
];

type ShopPageClientProps = {
  initialPageContent: ShopPageContent;
  initialResults: SearchResults;
  initialSearchParamsKey: string;
};

export default function ShopPageClient({
  initialPageContent,
  initialResults,
  initialSearchParamsKey,
}: ShopPageClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [searchResults, setSearchResults] = useState<SearchResults>(initialResults);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const loadedKeyRef = useRef(initialSearchParamsKey);
  const userIdRef = useRef<string | undefined>(session?.user?.id);

  useEffect(() => {
    userIdRef.current = session?.user?.id;
  }, [session?.user?.id]);

  // Keep client state synced when App Router SSR delivers fresh initialResults for a new query.
  useEffect(() => {
    setSearchResults(initialResults);
    setError(null);
    setIsLoading(false);
    loadedKeyRef.current = initialSearchParamsKey;
  }, [initialResults, initialSearchParamsKey]);

  const pageContent = initialPageContent ?? DEFAULT_SHOP_PAGE;
  const query = searchParams.get('q') || '';
  const currentSort = (searchParams.get('sort') || 'relevance') as SortOption;
  const currentPage = parseInt(searchParams.get('page') || '1', 10) || 1;
  const searchParamsKey = stableSearchParamsKey(searchParams);

  // Only hit /api/search if URL searchParams ever diverge from what SSR already provided.
  useEffect(() => {
    if (searchParamsKey === loadedKeyRef.current) {
      return undefined;
    }

    let cancelled = false;
    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(searchParamsKey);
        if (!params.has('limit')) {
          params.set('limit', '12');
        }
        if (userIdRef.current && params.get('q')?.trim()) {
          params.set('userId', userIdRef.current);
        }

        const response = await fetch(`/api/search?${params.toString()}`);
        const data = await response.json();

        if (cancelled) return;
        if (data.success) {
          setSearchResults(data);
          loadedKeyRef.current = searchParamsKey;
        } else {
          setError(data.error || 'Failed to load products');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Search error:', err);
          setError('Failed to load products');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchResults();

    return () => {
      cancelled = true;
    };
  }, [searchParamsKey]);

  const handleSortChange = (newSort: SortOption) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', newSort);
    params.delete('page');
    router.push(`/shop?${params.toString()}`);
  };

  const handleSearchQuery = (searchQuery: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = searchQuery.trim();
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    params.delete('page');
    const next = params.toString();
    router.push(next ? `/shop?${next}` : '/shop');
  };

  const purchaseInfo = pageContent.purchaseInfo ?? DEFAULT_SHOP_PAGE.purchaseInfo;
  const heroPadding = listingHeroPaddingClass(pageContent.hero?.height ?? 'compact');
  const productGridClass = gridColumnsClass(pageContent.layout?.gridColumns ?? '3');
  const showFilters = pageContent.layout?.showFilters ?? true;
  const filterCount = showFilters ? activeFilterCount(searchParams) : 0;
  const filterChips = showFilters ? activeFilterChips(searchParams) : [];
  const isCatalogEmpty = !isLoading
    && !error
    && searchResults.totalResults === 0
    && !query.trim()
    && filterCount === 0;
  const showFilterChrome = showFilters && !isCatalogEmpty;
  const quietCatalog = (searchResults.totalResults ?? 0) > 0
    && (searchResults.totalResults ?? 0) <= QUIET_SHOP_CATALOG_LIMIT;

  const handleRemoveFilterChip = (chipId: string) => {
    const next = removeFilterChip(searchParams, chipId);
    router.push(next ? `/shop?${next}` : '/shop');
  };

  return (
    <div className="min-h-screen bg-surface-muted">
      <section className="relative group bg-surface shadow-sm">
        <CmsEditAnchor targetKey="shop:listing" />
        <div className={`max-w-7xl mx-auto px-6 ${heroPadding}`}>
          <div className={`text-center ${isCatalogEmpty ? '' : 'mb-6'}`}>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{pageContent.title}</h1>
            {pageContent.subtitle && (
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                {pageContent.subtitle}
              </p>
            )}
          </div>

          {!isCatalogEmpty && (
            <div className="max-w-2xl mx-auto">
              <SearchBar
                className="w-full"
                placeholder={pageContent.searchPlaceholder}
                onSearch={handleSearchQuery}
              />
            </div>
          )}
        </div>
      </section>

      {showFilterChrome && (
        <div className="sticky top-16 z-30 border-b border-gray-200 bg-surface-muted/95 backdrop-blur lg:hidden">
          <div className="max-w-7xl mx-auto page-x py-2">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-surface px-3 text-sm font-medium text-gray-900"
              aria-expanded={mobileFiltersOpen}
              aria-controls="shop-filters-panel"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
              Filters & sort
              {filterCount > 0 && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-white">
                  {filterCount}
                </span>
              )}
              {currentSort !== 'relevance' && (
                <span className="truncate text-xs font-normal text-gray-500">
                  · {SORT_OPTIONS.find((option) => option.value === currentSort)?.label}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {showFilters && filterChips.length > 0 && (
        <div className="lg:hidden border-b border-gray-200 bg-surface">
          <div className="max-w-7xl mx-auto page-x py-2 flex flex-wrap gap-2">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleRemoveFilterChip(chip.id)}
                className="tap-target-inline rounded-full border border-gray-300 bg-surface-muted text-xs font-medium text-gray-800"
                aria-label={`Remove ${chip.label} filter`}
              >
                {chip.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto page-x py-8">
        <div className={`flex flex-col gap-8 ${showFilterChrome ? 'lg:flex-row' : ''}`}>
          {showFilterChrome && (
            <aside className="lg:w-64 flex-shrink-0">
              <FilterSidebar
                categories={searchResults.filterOptions?.categories}
                mediums={searchResults.filterOptions?.mediums}
                priceRanges={searchResults.filterOptions?.priceRanges}
                sizes={searchResults.filterOptions?.sizes}
                mobileOpen={mobileFiltersOpen}
                onMobileOpenChange={setMobileFiltersOpen}
                hideMobileTrigger
                sortOptions={SORT_OPTIONS}
                currentSort={currentSort}
                onSortChange={handleSortChange}
                quietMode={quietCatalog}
              />
            </aside>
          )}

          <div className="flex-1">
            {!isCatalogEmpty && (
              <div className="hidden lg:flex lg:items-center lg:justify-between mb-8">
                <div className="mb-4 sm:mb-0">
                  <p className="text-gray-600 text-sm">
                    {query
                      ? `${searchResults.totalResults} ${searchResults.totalResults === 1 ? 'result' : 'results'} for "${query}"`
                      : `${searchResults.totalResults} ${searchResults.totalResults === 1 ? 'artwork' : 'artworks'}`}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <label htmlFor="sort" className="text-sm text-gray-700">Sort by:</label>
                  <select
                    id="sort"
                    value={currentSort}
                    onChange={(e) => handleSortChange(e.target.value as SortOption)}
                    className="border border-gray-300 rounded-input px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {isLoading && (
              <div className={productGridClass}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 aspect-square rounded-lg mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Products</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-primary px-4 py-2"
                >
                  Try Again
                </button>
              </div>
            )}

            {!isLoading && !error && (
              <>
                {searchResults.products.length > 0 ? (
                  <div className={productGridClass}>
                    {searchResults.products.map((product, index) => (
                      <ShopProductCard
                        key={product.id}
                        product={product}
                        inventory={
                          searchResults.inventoryByProductId
                            ? (searchResults.inventoryByProductId[product.id] ?? null)
                            : undefined
                        }
                        priority={index < 3}
                      />
                    ))}
                  </div>
                ) : isCatalogEmpty ? (
                  <div className="mx-auto max-w-lg py-16 text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">The shop is being prepared</h2>
                    <p className="text-gray-600 mb-6">
                      New original works and prints will be available here soon.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Link href="/portfolio" className="btn-primary w-full sm:w-auto px-6 py-2.5 text-sm">
                        View Portfolio
                      </Link>
                      <Link href="/contact" className="btn-primary-outline w-full sm:w-auto px-6 py-2.5 text-sm">
                        Get in Touch
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="text-gray-400 mb-4">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No artworks found</h3>
                    <p className="text-gray-600 mb-5">
                      {query ? `No results for "${query}". Try adjusting your search or filters.` : 'No artworks match your current filters.'}
                    </p>
                    <Link
                      href="/shop"
                      className="btn-primary-outline inline-block px-5 py-2 text-sm"
                    >
                      Clear filters
                    </Link>
                    {searchResults.suggestions && searchResults.suggestions.length > 0 && (
                      <div className="mt-5">
                        <p className="text-sm text-gray-600 mb-2">Did you mean:</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {searchResults.suggestions.map((suggestion, index) => (
                            <Link
                              key={index}
                              href={`/shop?q=${encodeURIComponent(suggestion)}`}
                              className="text-gray-900 hover:text-gray-700 text-sm underline"
                            >
                              {suggestion}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {searchResults.totalResults > 12 && (
                  <Pagination
                    currentPage={currentPage}
                    totalResults={searchResults.totalResults}
                    resultsPerPage={12}
                    searchParams={searchParams}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {!query && pageContent.showRecommendations && (
          <div className="mt-10">
            <ProductRecommendations
              userId={session?.user?.id}
              maxSections={1}
              className="mb-0"
            />
          </div>
        )}

        {!query && pageContent.showRecentlyViewed && (
          <div className="mt-10">
            <RecentlyViewed
              maxItems={8}
              className="mb-0"
            />
          </div>
        )}
      </div>

      {pageContent.showPurchaseInfo && (
        <section className="relative group bg-surface section-space-tight border-t border-gray-200">
          <CmsEditAnchor targetKey="shop:purchase" />
          <div className="max-w-4xl mx-auto page-x text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-8">{purchaseInfo.title}</h2>

            <div className="hidden md:grid md:grid-cols-3 md:gap-8 text-left md:text-center">
              {(purchaseInfo.authenticityTitle.trim() || purchaseInfo.authenticityText.trim()) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{purchaseInfo.authenticityTitle}</h3>
                  <p className="text-gray-600">{purchaseInfo.authenticityText}</p>
                </div>
              )}
              {(purchaseInfo.shippingTitle.trim() || purchaseInfo.shippingText.trim()) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{purchaseInfo.shippingTitle}</h3>
                  <p className="text-gray-600">{purchaseInfo.shippingText}</p>
                </div>
              )}
              {(purchaseInfo.commissionsTitle.trim() || purchaseInfo.commissionsText.trim()) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{purchaseInfo.commissionsTitle}</h3>
                  <p className="text-gray-600">{purchaseInfo.commissionsText}</p>
                </div>
              )}
            </div>

            <div className="md:hidden space-y-2 text-left">
              {(purchaseInfo.authenticityTitle.trim() || purchaseInfo.authenticityText.trim()) && (
                <details className="rounded-lg border border-gray-200 bg-surface-muted px-4 py-3">
                  <summary className="tap-target-inline cursor-pointer list-none font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                    {purchaseInfo.authenticityTitle || 'Authenticity'}
                  </summary>
                  <p className="mt-2 text-sm text-gray-600">{purchaseInfo.authenticityText}</p>
                </details>
              )}
              {(purchaseInfo.shippingTitle.trim() || purchaseInfo.shippingText.trim()) && (
                <details className="rounded-lg border border-gray-200 bg-surface-muted px-4 py-3">
                  <summary className="tap-target-inline cursor-pointer list-none font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                    {purchaseInfo.shippingTitle || 'Shipping'}
                  </summary>
                  <p className="mt-2 text-sm text-gray-600">{purchaseInfo.shippingText}</p>
                </details>
              )}
              {(purchaseInfo.commissionsTitle.trim() || purchaseInfo.commissionsText.trim()) && (
                <details className="rounded-lg border border-gray-200 bg-surface-muted px-4 py-3">
                  <summary className="tap-target-inline cursor-pointer list-none font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                    {purchaseInfo.commissionsTitle || 'Commissions'}
                  </summary>
                  <p className="mt-2 text-sm text-gray-600">{purchaseInfo.commissionsText}</p>
                </details>
              )}
            </div>

            {purchaseInfo.ctaLabel.trim() && (
              <div className="mt-6 md:mt-8">
                <Link
                  href="/contact"
                  className="btn-primary px-6 py-3 inline-block"
                >
                  {purchaseInfo.ctaLabel}
                </Link>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  totalResults: number;
  resultsPerPage: number;
  searchParams: URLSearchParams;
}

function Pagination({ currentPage, totalResults, resultsPerPage, searchParams }: PaginationProps) {
  const totalPages = Math.ceil(totalResults / resultsPerPage);

  if (totalPages <= 1) return null;

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    return `/shop?${params.toString()}`;
  };

  const pages = [];
  const showEllipsis = totalPages > 7;

  if (showEllipsis) {
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push(-1);
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push(-1);
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push(-1);
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push(-2);
      pages.push(totalPages);
    }
  } else {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  }

  return (
    <div className="flex items-center justify-center space-x-2 mt-12">
      {currentPage > 1 && (
        <Link
          href={createPageUrl(currentPage - 1)}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-surface border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Previous
        </Link>
      )}

      {pages.map((page, index) => (
        <span key={index}>
          {page === -1 || page === -2 ? (
            <span className="px-3 py-2 text-sm font-medium text-gray-400">...</span>
          ) : (
            <Link
              href={createPageUrl(page)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                page === currentPage
                  ? 'bg-primary text-white'
                  : 'text-gray-500 bg-surface border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </Link>
          )}
        </span>
      ))}

      {currentPage < totalPages && (
        <Link
          href={createPageUrl(currentPage + 1)}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-surface border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Next
        </Link>
      )}
    </div>
  );
}
