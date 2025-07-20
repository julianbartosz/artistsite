'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Product } from '@/lib/commerce';
import { SearchResults, SortOption } from '@/lib/types';
import SearchBar from '@/components/SearchBar';
import FilterSidebar from '@/components/FilterSidebar';
import ProductRecommendations from '@/components/ProductRecommendations';
import RecentlyViewed from '@/components/RecentlyViewed';
import StockIndicator from '@/components/StockIndicator';
import { formatPrice } from '@/lib/commerce';

// Sort options for the dropdown
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_low_high', label: 'Price: Low to High' },
  { value: 'price_high_low', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'popularity', label: 'Most Popular' }
];

function ShopPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current search parameters
  const query = searchParams.get('q') || '';
  const currentSort = (searchParams.get('sort') || 'relevance') as SortOption;
  const currentPage = parseInt(searchParams.get('page') || '1');

  // Fetch search results
  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Build search URL with all parameters
        const params = new URLSearchParams(searchParams);
        if (!params.has('limit')) {
          params.set('limit', '12');
        }
        if (session?.user?.id) {
          params.set('userId', session.user.id);
        }

        const response = await fetch(`/api/search?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          setSearchResults(data);
        } else {
          setError('Failed to load products');
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [searchParams, session?.user?.id]);

  // Handle sort change
  const handleSortChange = (newSort: SortOption) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', newSort);
    params.delete('page'); // Reset to first page
    window.location.href = `/shop?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <section className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Art Shop</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Discover original paintings, drawings, prints, and collections. Each piece is 
              carefully crafted and comes with a certificate of authenticity.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <SearchBar className="w-full" />
          </div>
        </div>
      </section>

      {/* Personalized Recommendations (for authenticated users without search) */}
      {!query && session?.user?.id && (
        <section className="bg-white py-12 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6">
            <ProductRecommendations 
              userId={session.user.id}
              maxSections={1}
              className="mb-0"
            />
          </div>
        </section>
      )}

      {/* Recently Viewed (for all users) */}
      {!query && (
        <section className="bg-gray-50 py-12 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6">
            <RecentlyViewed 
              maxItems={8}
              className="mb-0"
            />
          </div>
        </section>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <FilterSidebar />
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Results Header */}
            {searchResults && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                <div className="mb-4 sm:mb-0">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {query ? `Search Results for "${query}"` : 'All Artworks'}
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    {searchResults.totalResults} {searchResults.totalResults === 1 ? 'result' : 'results'}
                    {searchResults.searchTime && ` found in ${searchResults.searchTime}ms`}
                  </p>
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center space-x-2">
                  <label htmlFor="sort" className="text-sm text-gray-700">Sort by:</label>
                  <select
                    id="sort"
                    value={currentSort}
                    onChange={(e) => handleSortChange(e.target.value as SortOption)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Products Grid */}
            {searchResults && !isLoading && (
              <>
                {searchResults.products.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchResults.products.map((product) => (
                      <ProductCard key={product.id} product={product} />
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
                              className="text-blue-600 hover:text-blue-800 text-sm underline"
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
      </div>

      {/* Info Section */}
      <section className="bg-white py-16 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Purchase Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Authenticity</h3>
              <p className="text-gray-600">
                All original works come with a signed certificate of authenticity.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Shipping</h3>
              <p className="text-gray-600">
                Carefully packaged and insured shipping worldwide. Domestic shipping 
                starts at $15.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Commissions</h3>
              <p className="text-gray-600">
                Interested in a custom piece? Contact me to discuss commission 
                opportunities.
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

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  const isLimitedEdition = product.edition && product.edition.remaining < product.edition.total;
  
  return (
    <Link href={`/shop/${product.id}`} className="group">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
        {/* Product Image */}
        <div className="relative aspect-square bg-gray-100">
          <Image
            src={product.images.thumbnail}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {product.featured && (
            <div className="absolute top-3 left-3">
              <span className="bg-blue-600 text-white px-2 py-1 text-xs font-medium rounded">
                Featured
              </span>
            </div>
          )}
          {isLimitedEdition && (
            <div className="absolute top-3 right-3">
              <span className="bg-red-600 text-white px-2 py-1 text-xs font-medium rounded">
                Limited Edition
              </span>
            </div>
          )}
        </div>
        
        {/* Product Info */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
            {product.title}
          </h3>
          <p className="text-sm text-gray-600 mb-2">{product.medium}</p>
          <p className="text-sm text-gray-500 mb-3">{product.dimensions}</p>
          <p className="text-gray-700 text-sm mb-4 line-clamp-2">{product.description}</p>
          
          <div className="flex justify-between items-start mb-3">
            <span className="text-xl font-bold text-gray-900">
              {formatPrice(product.price, product.currency)}
            </span>
            <span className="text-sm text-gray-500 capitalize">
              {product.category.replace('-', ' ')}
            </span>
          </div>

          {/* Stock Indicator */}
          <div className="mb-3">
            <StockIndicator productId={product.id} />
          </div>
          
          {isLimitedEdition && (
            <p className="text-xs text-red-600 mt-2">
              Only {product.edition!.remaining} of {product.edition!.total} remaining
            </p>
          )}
        </div>
      </div>
    </Link>
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
                  ? 'bg-blue-600 text-white'
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