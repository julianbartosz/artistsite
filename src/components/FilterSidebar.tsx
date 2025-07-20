'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchFilters } from '@/lib/types';
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface FilterSidebarProps {
  className?: string;
  onFiltersChange?: (filters: SearchFilters) => void;
}

interface FilterSection {
  id: string;
  title: string;
  isOpen: boolean;
}

const CATEGORIES = [
  'Paintings',
  'Sculptures',
  'Prints',
  'Digital Art',
  'Mixed Media',
  'Photography'
];

const MEDIUMS = [
  'Oil',
  'Acrylic',
  'Watercolor',
  'Digital',
  'Bronze',
  'Marble',
  'Canvas',
  'Paper'
];

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

export function FilterSidebar({ className = "", onFiltersChange }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sections, setSections] = useState<FilterSection[]>([
    { id: 'categories', title: 'Categories', isOpen: true },
    { id: 'price', title: 'Price Range', isOpen: true },
    { id: 'medium', title: 'Medium', isOpen: false },
    { id: 'dimensions', title: 'Size', isOpen: false }
  ]);

  // Initialize filters from URL params
  useEffect(() => {
    const initialFilters: SearchFilters = {};

    const categories = searchParams.get('categories');
    if (categories) {
      initialFilters.categories = categories.split(',');
    }

    const medium = searchParams.get('medium');
    if (medium) {
      initialFilters.medium = medium.split(',');
    }

    const dimensions = searchParams.get('dimensions');
    if (dimensions) {
      initialFilters.dimensions = dimensions.split(',');
    }

    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    if (priceMin || priceMax) {
      initialFilters.priceRange = {
        min: priceMin ? parseFloat(priceMin) : 0,
        max: priceMax ? parseFloat(priceMax) : 10000
      };
    }

    const availability = searchParams.get('availability');
    if (availability === 'in_stock') {
      initialFilters.availability = 'in_stock';
    }

    setFilters(initialFilters);
  }, [searchParams]);

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

  const clearAllFilters = () => {
    setFilters({});
    if (onFiltersChange) {
      onFiltersChange({});
    } else {
      router.push('/shop');
    }
  };

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

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <XMarkIcon className="h-4 w-4" />
            <span>Clear all ({activeFilterCount})</span>
          </button>
        )}
      </div>

      {/* Categories Filter */}
      <FilterSection
        title="Categories"
        isOpen={sections.find(s => s.id === 'categories')?.isOpen || false}
        onToggle={() => toggleSection('categories')}
      >
        <div className="space-y-3">
          {CATEGORIES.map(category => (
            <label key={category} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.categories?.includes(category) || false}
                onChange={(e) => handleCategoryChange(category, e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{category}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Price Range Filter */}
      <FilterSection
        title="Price Range"
        isOpen={sections.find(s => s.id === 'price')?.isOpen || false}
        onToggle={() => toggleSection('price')}
      >
        <div className="space-y-3">
          {PRICE_RANGES.map(range => (
            <label key={range.label} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="priceRange"
                checked={
                  filters.priceRange?.min === range.min && 
                  filters.priceRange?.max === range.max
                }
                onChange={() => handlePriceRangeChange(range.min, range.max)}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{range.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Medium Filter */}
      <FilterSection
        title="Medium"
        isOpen={sections.find(s => s.id === 'medium')?.isOpen || false}
        onToggle={() => toggleSection('medium')}
      >
        <div className="space-y-3">
          {MEDIUMS.map(medium => (
            <label key={medium} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.medium?.includes(medium) || false}
                onChange={(e) => handleMediumChange(medium, e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{medium}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Dimensions Filter */}
      <FilterSection
        title="Size"
        isOpen={sections.find(s => s.id === 'dimensions')?.isOpen || false}
        onToggle={() => toggleSection('dimensions')}
      >
        <div className="space-y-3">
          {DIMENSIONS.map(dimension => (
            <label key={dimension.value} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.dimensions?.includes(dimension.value) || false}
                onChange={(e) => handleDimensionChange(dimension.value, e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{dimension.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>
    </div>
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