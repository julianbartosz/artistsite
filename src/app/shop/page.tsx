'use client';

import React, { useState, useEffect, Suspense } from 'react';
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
import { DEFAULT_SHOP_PAGE, gridColumnsClass, listingHeroPaddingClass, shopPageSchema, type ShopPageContent } from '@/lib/site-content-shared';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

// Sort options for the dropdown
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_low_high', label: 'Price: Low to High' },
  { value: 'price_high_low', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'popularity', label: 'Most Popular' }
];

function ShopPageContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageContent, setPageContent] = useState<ShopPageContent>(DEFAULT_SHOP_PAGE);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Get current search parameters
  const query = searchParams.get('q') || '';
  const currentSort = (searchParams.get('sort') || 'relevance') as SortOption;
  const currentPage = parseInt(searchParams.get('page') || '1');
  const searchParamsKey = stableSearchParamsKey(searchParams);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/site-content/public')
      .then((response) => response.json())
      .then((data) => {
        const parsed = shopPageSchema.safeParse(data?.shop);
        if (!cancelled && parsed.success) {
          setPageContent(parsed.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPageContent(DEFAULT_SHOP_PAGE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch search results
  useEffect(() => {
    let cancelled = false;

    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(searchParamsKey);
        if (!params.has('limit')) {
          params.set('limit', '12');
        }
        if (session?.user?.id) {
          params.set('userId', session.user.id);
        }

        const response = await fetch(`/api/search?${params.toString()}`);
        const data = await response.json();

        if (cancelled) return;

        if (data.success) {
          setSearchResults(data);
        } else {
          setError('Failed to load products');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Search error:', err);
        setError('Failed to load products');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      cancelled = true;
    };
  }, [searchParamsKey, session?.user?.id]);

  // Handle sort change
  const handleSortChange = (newSort: SortOption) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', newSort);
    params.delete('page'); // Reset to first page
    router.push(`/shop?${params.toString()}`);
  };

  const purchaseInfo = pageContent.purchaseInfo ?? DEFAULT_SHOP_PAGE.purchaseInfo;
  const heroPadding = listingHeroPaddingClass(pageContent.hero?.height ?? 'compact');
  const productGridClass = gridColumnsClass(pageContent.layout?.gridColumns ?? '3');
  const showFilters = pageContent.layout?.showFilters ?? true;
  const filterCount = showFilters ? activeFilterCount(searchParams) : 0;
  const filterChips = showFilters ? activeFilterChips(searchParams) : [];

  const handleRemoveFilterChip = (chipId: string) => {
    const next = removeFilterChip(searchParams, chipId);
    router.push(next ? `/shop?${next}` : '/shop');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative group bg-white shadow-sm">
        <CmsEditAnchor targetKey="shop:listing" />
        <div className={`max-w-7xl mx-auto px-6 ${heroPadding}`}>
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{pageContent.title}</h1>
            {pageContent.subtitle && (
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                {pageContent.subtitle}
              </p>
            )}
          </div>

          <div className="max-w-2xl mx-auto">
            <SearchBar className="w-full" placeholder={pageContent.searchPlaceholder} />
          </div>
        </div>
      </section>

      {showFilters && (
      <div className="sticky top-16 z-30 border-b border-gray-200 bg-gray-50/95 backdrop-blur lg:hidden">
        <div className="max-w-7xl mx-auto page-x py-2">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900"
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
        <div className="lg:hidden border-b border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto page-x py-2 flex flex-wrap gap-2">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleRemoveFilterChip(chip.id)}
                className="tap-target-inline rounded-full border border-gray-300 bg-gray-50 text-xs font-medium text-gray-800"
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
        <div className={`flex flex-col gap-8 ${showFilters ? 'lg:flex-row' : ''}`}>
          {showFilters && (
          <aside className="lg:w-64 flex-shrink-0">
            <FilterSidebar
              categories={searchResults?.filterOptions?.categories}
              mediums={searchResults?.filterOptions?.mediums}
              mobileOpen={mobileFiltersOpen}
              onMobileOpenChange={setMobileFiltersOpen}
              hideMobileTrigger
              sortOptions={SORT_OPTIONS}
              currentSort={currentSort}
              onSortChange={handleSortChange}
            />
          </aside>
          )}

          <main className="flex-1">
            {searchResults && (
              <div className="hidden lg:flex lg:items-center lg:justify-between mb-8">
                <div className="mb-4 sm:mb-0">
                  <p className="text-gray-600 text-sm">
                    {query
                      ? `${searchResults.totalResults} ${searchResults.totalResults === 1 ? 'result' : 'results'} for "${query}"`
                      : `${searchResults.totalResults} ${searchResults.totalResults === 1 ? 'artwork' : 'artworks'}`}
                    {searchResults.searchTime > 0 ? ` · ${searchResults.searchTime}ms` : ''}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <label htmlFor="sort" className="text-sm text-gray-700">Sort by:</label>
                  <select
                    id="sort"
                    value={currentSort}
                    onChange={(e) => handleSortChange(e.target.value as SortOption)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className={productGridClass}>
                {[1, 2, 3, 4, 5, 6].map(i => (
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

            {/* Error State */}
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
                  className="btn-primary px-4 py-2 rounded-md"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Products Grid */}
            {searchResults && !isLoading && (
              <>
                {searchResults.products.length > 0 ? (
                  <div className={productGridClass}>
                    {searchResults.products.map((product) => (
                      <ShopProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="text-gray-400 mb-4">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                    <p className="text-gray-600 mb-4">
                      {query ? `No results for "${query}". Try adjusting your search or filters.` : 'No products match your current filters.'}
                    </p>
                    {searchResults.suggestions && searchResults.suggestions.length > 0 && (
                      <div className="mt-4">
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

                {/* Pagination */}
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
          </main>
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
      <section className="relative group bg-white section-space-tight border-t border-gray-200">
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
              <details className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <summary className="tap-target-inline cursor-pointer list-none font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                  {purchaseInfo.authenticityTitle || 'Authenticity'}
                </summary>
                <p className="mt-2 text-sm text-gray-600">{purchaseInfo.authenticityText}</p>
              </details>
            )}
            {(purchaseInfo.shippingTitle.trim() || purchaseInfo.shippingText.trim()) && (
              <details className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <summary className="tap-target-inline cursor-pointer list-none font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                  {purchaseInfo.shippingTitle || 'Shipping'}
                </summary>
                <p className="mt-2 text-sm text-gray-600">{purchaseInfo.shippingText}</p>
              </details>
            )}
            {(purchaseInfo.commissionsTitle.trim() || purchaseInfo.commissionsText.trim()) && (
              <details className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
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
              className="btn-primary px-6 py-3 rounded-lg inline-block"
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
    // Show first page, current page range, and last page with ellipsis
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push(-1); // Ellipsis
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push(-1); // Ellipsis
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push(-1); // Ellipsis
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push(-2); // Ellipsis
      pages.push(totalPages);
    }
  } else {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  }

  return (
    <div className="flex items-center justify-center space-x-2 mt-12">
      {/* Previous */}
      {currentPage > 1 && (
        <Link
          href={createPageUrl(currentPage - 1)}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Previous
        </Link>
      )}

      {/* Page Numbers */}
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
                  : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </Link>
          )}
        </span>
      ))}

      {/* Next */}
      {currentPage < totalPages && (
        <Link
          href={createPageUrl(currentPage + 1)}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Next
        </Link>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    }>
      <ShopPageContent />
    </Suspense>
  );
}