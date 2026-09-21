'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchFilters, SortOption } from '@/lib/types';
import { stableSearchParamsKey, displayFilterLabel } from '@/lib/search-params';
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

interface FilterSidebarProps {
  className?: string;
  onFiltersChange?: (filters: SearchFilters) => void;
  categories?: string[];
  mediums?: string[];
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  hideMobileTrigger?: boolean;
  /** When provided, sort controls appear in the mobile sheet (avoids a truncated sticky select). */
  sortOptions?: Array<{ value: SortOption; label: string }>;
  currentSort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

interface FilterSection {
  id: string;
  title: string;
  isOpen: boolean;
}

const DIMENSIONS = [
  { label: 'Small (under 12")', value: 'small' },
  { label: 'Medium (12" - 24")', value: 'medium' },
  { label: 'Large (over 24")', value: 'large' }
];

const PRICE_RANGES = [
  { label: 'Under $500', min: 0, max: 500 },
  { label: '$500 - $1,000', min: 500, max: 1000 },
  { label: '$1,000 - $2,500', min: 1000, max: 2500 },
  { label: '$2,500 - $5,000', min: 2500, max: 5000 },
  { label: 'Over $5,000', min: 5000, max: 50000 }
];

export function FilterSidebar({
  className = "",
  onFiltersChange,
  categories = [],
  mediums = [],
  mobileOpen: controlledMobileOpen,
  onMobileOpenChange,
  hideMobileTrigger = false,
  sortOptions,
  currentSort,
  onSortChange,
}: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = stableSearchParamsKey(searchParams);
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileOpen = controlledMobileOpen ?? internalMobileOpen;
  const setMobileOpen = onMobileOpenChange ?? setInternalMobileOpen;
  
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sections, setSections] = useState<FilterSection[]>([
    { id: 'categories', title: 'Categories', isOpen: true },
    { id: 'price', title: 'Price Range', isOpen: true },
    { id: 'availability', title: 'Availability', isOpen: true },
    { id: 'medium', title: 'Medium', isOpen: false },
    { id: 'dimensions', title: 'Size', isOpen: false }
  ]);

  // Initialize filters from URL params
  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const initialFilters: SearchFilters = {};

    const categories = params.get('categories');
    if (categories) {
      initialFilters.categories = categories.split(',');
    }

    const medium = params.get('medium');
    if (medium) {
      initialFilters.medium = medium.split(',');
    }

    const dimensions = params.get('dimensions');
    if (dimensions) {
      initialFilters.dimensions = dimensions.split(',');
    }

    const priceMin = params.get('priceMin');
    const priceMax = params.get('priceMax');
    if (priceMin || priceMax) {
      initialFilters.priceRange = {
        min: priceMin ? parseFloat(priceMin) : 0,
        max: priceMax ? parseFloat(priceMax) : 10000
      };
    }

    const availability = params.get('availability');
    if (availability === 'in_stock') {
      initialFilters.availability = 'in_stock';
    }

    setFilters(initialFilters);
  }, [searchParamsKey]);

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, isOpen: !section.isOpen }
        : section
    ));
  };

  const updateFilters = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    } else {
      // Update URL parameters
      const params = new URLSearchParams(searchParams);
      
      // Clear existing filter params
      params.delete('categories');
      params.delete('medium');
      params.delete('dimensions');
      params.delete('priceMin');
      params.delete('priceMax');
      params.delete('availability');
      params.delete('page'); // Reset to first page

      // Set new filter params
      if (newFilters.categories?.length) {
        params.set('categories', newFilters.categories.join(','));
      }
      if (newFilters.medium?.length) {
        params.set('medium', newFilters.medium.join(','));
      }
      if (newFilters.dimensions?.length) {
        params.set('dimensions', newFilters.dimensions.join(','));
      }
      if (newFilters.priceRange) {
        if (newFilters.priceRange.min > 0) {
          params.set('priceMin', newFilters.priceRange.min.toString());
        }
        if (newFilters.priceRange.max < 50000) {
          params.set('priceMax', newFilters.priceRange.max.toString());
        }
      }
      if (newFilters.availability) {
        params.set('availability', newFilters.availability);
      }

      router.push(`/shop?${params.toString()}`);
    }
  };

  const handleCategoryChange = (category: string, checked: boolean) => {
    const categories = filters.categories || [];
    const newCategories = checked
      ? [...categories, category]
      : categories.filter(c => c !== category);

    updateFilters({
      ...filters,
      categories: newCategories.length > 0 ? newCategories : undefined
    });
  };

  const handleMediumChange = (medium: string, checked: boolean) => {
    const mediums = filters.medium || [];
    const newMediums = checked
      ? [...mediums, medium]
      : mediums.filter(m => m !== medium);

    updateFilters({
      ...filters,
      medium: newMediums.length > 0 ? newMediums : undefined
    });
  };

  const handleDimensionChange = (dimension: string, checked: boolean) => {
    const dimensions = filters.dimensions || [];
    const newDimensions = checked
      ? [...dimensions, dimension]
      : dimensions.filter(d => d !== dimension);

    updateFilters({
      ...filters,
      dimensions: newDimensions.length > 0 ? newDimensions : undefined
    });
  };

  const handlePriceRangeChange = (min: number, max: number) => {
    updateFilters({
      ...filters,
      priceRange: { min, max }
    });
  };

  const handleAvailabilityChange = (checked: boolean) => {
    updateFilters({
      ...filters,
      availability: checked ? 'in_stock' : undefined,
    });
  };

  const clearAllFilters = () => {
    setFilters({});
    if (onFiltersChange) {
      onFiltersChange({});
    } else {
      router.push('/shop');
    }
    setMobileOpen(false);
  };

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    document.body.style.overflow = '';
  }, [mobileOpen]);

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.categories?.length) count += filters.categories.length;
    if (filters.medium?.length) count += filters.medium.length;
    if (filters.dimensions?.length) count += filters.dimensions.length;
    if (filters.priceRange) count += 1;
    if (filters.availability) count += 1;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  const filterPanel = (
    <>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm text-gray-700 hover:text-gray-900 flex items-center gap-1"
          >
            <XMarkIcon className="h-4 w-4" />
            <span>Clear all ({activeFilterCount})</span>
          </button>
        )}
      </div>

      {sortOptions && sortOptions.length > 0 && onSortChange && (
        <div className="mb-6 border-b border-gray-200 pb-6 lg:hidden">
          <label htmlFor="shop-sort-sheet" className="mb-2 block text-sm font-medium text-gray-900">
            Sort by
          </label>
          <select
            id="shop-sort-sheet"
            value={currentSort || 'relevance'}
            onChange={(event) => onSortChange(event.target.value as SortOption)}
            className="min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      )}

      {categories.length > 0 && (
      <FilterSection
        title="Categories"
        isOpen={sections.find(s => s.id === 'categories')?.isOpen || false}
        onToggle={() => toggleSection('categories')}
      >
        <div className="space-y-3">
          {categories.map(category => (
            <label key={category} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.categories?.includes(category) || false}
                onChange={(e) => handleCategoryChange(category, e.target.checked)}
                className="h-4 w-4 text-gray-900 rounded border-gray-300 focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">{displayFilterLabel(category)}</span>
            </label>
          ))}
        </div>
      </FilterSection>
      )}

      <FilterSection
        title="Price Range"
        isOpen={sections.find(s => s.id === 'price')?.isOpen || false}
        onToggle={() => toggleSection('price')}
      >
        <div className="space-y-3">
          {PRICE_RANGES.map(range => (
            <label key={range.label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="priceRange"
                checked={
                  filters.priceRange?.min === range.min &&
                  filters.priceRange?.max === range.max
                }
                onChange={() => handlePriceRangeChange(range.min, range.max)}
                className="h-4 w-4 text-gray-900 border-gray-300 focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">{range.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection
        title="Availability"
        isOpen={sections.find(s => s.id === 'availability')?.isOpen ?? true}
        onToggle={() => toggleSection('availability')}
      >
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.availability === 'in_stock'}
            onChange={(event) => handleAvailabilityChange(event.target.checked)}
            className="h-4 w-4 text-gray-900 rounded border-gray-300 focus:ring-gray-500"
          />
          <span className="text-sm text-gray-700">In stock only</span>
        </label>
      </FilterSection>

      {mediums.length > 0 && (
      <FilterSection
        title="Medium"
        isOpen={sections.find(s => s.id === 'medium')?.isOpen || false}
        onToggle={() => toggleSection('medium')}
      >
        <div className="space-y-3">
          {mediums.map(medium => (
            <label key={medium} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.medium?.includes(medium) || false}
                onChange={(e) => handleMediumChange(medium, e.target.checked)}
                className="h-4 w-4 text-gray-900 rounded border-gray-300 focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">{displayFilterLabel(medium)}</span>
            </label>
          ))}
        </div>
      </FilterSection>
      )}

      <FilterSection
        title="Size"
        isOpen={sections.find(s => s.id === 'dimensions')?.isOpen || false}
        onToggle={() => toggleSection('dimensions')}
      >
        <div className="space-y-3">
          {DIMENSIONS.map(dimension => (
            <label key={dimension.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.dimensions?.includes(dimension.value) || false}
                onChange={(e) => handleDimensionChange(dimension.value, e.target.checked)}
                className="h-4 w-4 text-gray-900 rounded border-gray-300 focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">{dimension.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>
    </>
  );

  return (
    <>
      {!hideMobileTrigger && (
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
          aria-expanded={mobileOpen}
          aria-controls="shop-filters-panel"
        >
          <AdjustmentsHorizontalIcon className="h-5 w-5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
      )}

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            id="shop-filters-panel"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(85vh,640px)] flex-col rounded-t-2xl bg-white shadow-xl lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Shop filters"
          >
            <div className="mx-auto mt-3 h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-300" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {sortOptions && sortOptions.length > 0 ? 'Filters & sort' : 'Filter artworks'}
              </h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="tap-target rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close filters"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{filterPanel}</div>
            <div className="border-t border-gray-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
              >
                View results
              </button>
            </div>
          </div>
        </>
      )}

      <div className={`hidden lg:block bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
        {filterPanel}
      </div>
    </>
  );
}

interface FilterSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterSection({ title, isOpen, onToggle, children }: FilterSectionProps) {
  return (
    <div className="border-b border-gray-200 pb-6 mb-6 last:border-b-0 last:pb-0 last:mb-0">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-2 text-left"
      >
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
        {isOpen ? (
          <ChevronUpIcon className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default FilterSidebar;