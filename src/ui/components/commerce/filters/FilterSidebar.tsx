'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchFilters } from '@/lib/types';
import FilterSection from './FilterSection';
import CheckboxGroup from './CheckboxGroup';
import { CATEGORIES, MEDIUMS, DIMENSIONS, PRICE_RANGES } from './constants';

export interface FilterSidebarProps {
  className?: string;
  onFiltersChange?: (filters: SearchFilters) => void;
}

interface SectionState { id: string; isOpen: boolean }

export default function FilterSidebar({ className = '', onFiltersChange }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<SearchFilters>({});
  const [sections, setSections] = useState<SectionState[]>([
    { id: 'categories', isOpen: true },
    { id: 'price', isOpen: true },
    { id: 'medium', isOpen: false },
    { id: 'dimensions', isOpen: false },
  ]);

  // Initialize filters from URL params
  useEffect(() => {
    const initial: SearchFilters = {};
    const categories = searchParams.get('categories');
    if (categories) initial.categories = categories.split(',');

    const medium = searchParams.get('medium');
    if (medium) initial.medium = medium.split(',');

    const dimensions = searchParams.get('dimensions');
    if (dimensions) initial.dimensions = dimensions.split(',');

    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    if (priceMin || priceMax) initial.priceRange = {
      min: priceMin ? parseFloat(priceMin) : 0,
      max: priceMax ? parseFloat(priceMax) : 10000,
    };

    const availability = searchParams.get('availability');
    if (availability === 'in_stock') initial.availability = 'in_stock';

    setFilters(initial);
  }, [searchParams]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categories?.length) count += filters.categories.length;
    if (filters.medium?.length) count += filters.medium.length;
    if (filters.dimensions?.length) count += filters.dimensions.length;
    if (filters.priceRange) count += 1;
    if (filters.availability) count += 1;
    return count;
  }, [filters]);

  const toggleSection = (id: string) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, isOpen: !s.isOpen } : s)));

  const updateFilters = (next: SearchFilters) => {
    setFilters(next);
    if (onFiltersChange) return onFiltersChange(next);

    const params = new URLSearchParams(searchParams);
    // Clear existing filter params
    ['categories', 'medium', 'dimensions', 'priceMin', 'priceMax', 'availability', 'page']
      .forEach((k) => params.delete(k));
    // Set new filter params
    if (next.categories?.length) params.set('categories', next.categories.join(','));
    if (next.medium?.length) params.set('medium', next.medium.join(','));
    if (next.dimensions?.length) params.set('dimensions', next.dimensions.join(','));
    if (next.priceRange) {
      if (next.priceRange.min > 0) params.set('priceMin', String(next.priceRange.min));
      if (next.priceRange.max < 50000) params.set('priceMax', String(next.priceRange.max));
    }
    if (next.availability) params.set('availability', next.availability);

    router.push(`/shop?${params.toString()}`);
  };

  const onCategoryChange = (value: string, checked: boolean) => {
    const current = filters.categories || [];
    const categories = checked ? [...current, value] : current.filter((v) => v !== value);
    updateFilters({ ...filters, categories: categories.length ? categories : undefined });
  };

  const onMediumChange = (value: string, checked: boolean) => {
    const current = filters.medium || [];
    const next = checked ? [...current, value] : current.filter((v) => v !== value);
    updateFilters({ ...filters, medium: next.length ? next : undefined });
  };

  const onDimensionChange = (value: string, checked: boolean) => {
    const current = filters.dimensions || [];
    const next = checked ? [...current, value] : current.filter((v) => v !== value);
    updateFilters({ ...filters, dimensions: next.length ? next : undefined });
  };

  const onPriceChange = (min: number, max: number) => updateFilters({ ...filters, priceRange: { min, max } });

  const clearAll = () => {
    setFilters({});
    if (onFiltersChange) return onFiltersChange({});
    router.push('/shop');
  };

  const isOpen = (id: string) => sections.find((s) => s.id === id)?.isOpen || false;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        {activeFilterCount > 0 && (
          <button onClick={clearAll} className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1">
            <span aria-hidden>✕</span>
            <span>Clear all ({activeFilterCount})</span>
          </button>
        )}
      </div>

      {/* Categories */}
      <FilterSection title="Categories" isOpen={isOpen('categories')} onToggle={() => toggleSection('categories')}>
        <CheckboxGroup name="categories" options={CATEGORIES} selected={filters.categories || []} onChange={onCategoryChange} />
      </FilterSection>

      {/* Price */}
      <FilterSection title="Price Range" isOpen={isOpen('price')} onToggle={() => toggleSection('price')}>
        <div className="space-y-3">
          {PRICE_RANGES.map((r) => (
            <label key={r.label} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="priceRange"
                checked={filters.priceRange?.min === r.min && filters.priceRange?.max === r.max}
                onChange={() => onPriceChange(r.min, r.max)}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{r.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Medium */}
      <FilterSection title="Medium" isOpen={isOpen('medium')} onToggle={() => toggleSection('medium')}>
        <CheckboxGroup name="medium" options={MEDIUMS} selected={filters.medium || []} onChange={onMediumChange} />
      </FilterSection>

      {/* Dimensions */}
      <FilterSection title="Size" isOpen={isOpen('dimensions')} onToggle={() => toggleSection('dimensions')}>
        <CheckboxGroup name="dimensions" options={DIMENSIONS.map((d) => ({ label: d.label, value: d.value }))} selected={filters.dimensions || []} onChange={onDimensionChange} />
      </FilterSection>
    </div>
  );
}
