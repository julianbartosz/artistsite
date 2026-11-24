import type { SearchFilters, SortOption } from './types';

export type CatalogPriceRange = {
  label: string;
  min: number;
  max: number;
};

const VALID_SORT_OPTIONS = new Set<SortOption>([
  'relevance',
  'price_low_high',
  'price_high_low',
  'newest',
  'popularity',
  'rating',
]);

export type ParsedProductSearchParams = {
  query: string;
  page: number;
  limit: number;
  sortBy: SortOption;
  filters: SearchFilters;
  userId?: string;
  sessionId?: string;
};

/** Shared URLSearchParams parser used by both /shop SSR and /api/search so filter semantics never drift. */
export function parseProductSearchParams(searchParams: URLSearchParams): ParsedProductSearchParams {
  const query = searchParams.get('q') || '';
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') || '12', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 12;
  const rawSort = (searchParams.get('sort') || 'relevance') as SortOption;
  const sortBy: SortOption = VALID_SORT_OPTIONS.has(rawSort) ? rawSort : 'relevance';
  const userId = searchParams.get('userId') || undefined;
  const sessionId = searchParams.get('sessionId') || undefined;

  const filters: SearchFilters = {};

  const categories = searchParams.get('categories');
  if (categories) {
    filters.categories = categories.split(',').filter(Boolean);
  }

  const medium = searchParams.get('medium');
  if (medium) {
    filters.medium = medium.split(',').filter(Boolean);
  }

  const dimensions = searchParams.get('dimensions');
  if (dimensions) {
    filters.dimensions = dimensions.split(',').filter(Boolean);
  }

  const priceMin = searchParams.get('priceMin');
  const priceMax = searchParams.get('priceMax');
  if (priceMin || priceMax) {
    const parsedMin = priceMin ? parseFloat(priceMin) : 0;
    const parsedMax = priceMax ? parseFloat(priceMax) : 10000;
    filters.priceRange = {
      min: Number.isFinite(parsedMin) ? parsedMin : 0,
      max: Number.isFinite(parsedMax) ? parsedMax : 10000,
    };
  }

  const availability = searchParams.get('availability');
  if (availability === 'in_stock') {
    filters.availability = 'in_stock';
  }

  return { query, page, limit, sortBy, filters, userId, sessionId };
}

/**
 * Derive human-friendly price filter brackets scaled to the artist's actual catalog prices.
 * Returns an empty array when fewer than two brackets contain products (no useful price split).
 */
export function buildCatalogPriceRanges(prices: number[]): CatalogPriceRange[] {
  const valid = prices.filter((price) => typeof price === 'number' && Number.isFinite(price) && price >= 0);
  if (valid.length < 2) return [];

  const minPrice = Math.min(...valid);
  const maxPrice = Math.max(...valid);
  if (maxPrice <= minPrice) return [];

  const upperCap = Math.max(50000, Math.ceil(maxPrice));
  let candidates: CatalogPriceRange[];
  if (maxPrice <= 50) {
    candidates = [
      { label: 'Under $10', min: 0, max: 10 },
      { label: '$10 – $25', min: 10, max: 25 },
      { label: '$25 – $50', min: 25, max: 50 },
    ];
  } else if (maxPrice <= 200) {
    candidates = [
      { label: 'Under $25', min: 0, max: 25 },
      { label: '$25 – $75', min: 25, max: 75 },
      { label: '$75 – $150', min: 75, max: 150 },
      { label: 'Over $150', min: 150, max: upperCap },
    ];
  } else if (maxPrice <= 1000) {
    candidates = [
      { label: 'Under $100', min: 0, max: 100 },
      { label: '$100 – $250', min: 100, max: 250 },
      { label: '$250 – $500', min: 250, max: 500 },
      { label: 'Over $500', min: 500, max: upperCap },
    ];
  } else {
    candidates = [
      { label: 'Under $500', min: 0, max: 500 },
      { label: '$500 – $1,000', min: 500, max: 1000 },
      { label: '$1,000 – $2,500', min: 1000, max: 2500 },
      { label: '$2,500 – $5,000', min: 2500, max: 5000 },
      { label: 'Over $5,000', min: 5000, max: upperCap },
    ];
  }

  const populated = candidates.filter((bracket) =>
    valid.some((price) => price >= bracket.min && price <= bracket.max),
  );
  return populated.length >= 2 ? populated : [];
}

/** Stable dependency key for URL search params (object reference changes every render). */
export function stableSearchParamsKey(searchParams: { toString(): string }): string {
  const params = new URLSearchParams(searchParams.toString());
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}

export function displayFilterLabel(value: string): string {
  const parts: string[] = [];
  let current = '';
  for (const char of value) {
    if (char === '-' || char === '_' || char === ' ') {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || value;
}

export function activeFilterCount(searchParams: { toString(): string }): number {
  return activeFilterChips(searchParams).length;
}

export type ActiveFilterChip = {
  id: string;
  label: string;
};

function splitParamList(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function activeFilterChips(searchParams: { toString(): string }): ActiveFilterChip[] {
  const params = new URLSearchParams(searchParams.toString());
  const chips: ActiveFilterChip[] = [];

  for (const category of splitParamList(params.get('categories'))) {
    chips.push({ id: `categories:${category}`, label: displayFilterLabel(category) });
  }

  for (const medium of splitParamList(params.get('medium'))) {
    chips.push({ id: `medium:${medium}`, label: displayFilterLabel(medium) });
  }

  for (const dimension of splitParamList(params.get('dimensions'))) {
    const dimensionLabel = dimension === 'small'
      ? 'Small'
      : dimension === 'medium'
        ? 'Medium'
        : dimension === 'large'
          ? 'Large'
          : displayFilterLabel(dimension);
    chips.push({ id: `dimensions:${dimension}`, label: dimensionLabel });
  }

  const priceMin = params.get('priceMin');
  const priceMax = params.get('priceMax');
  if (priceMin || priceMax) {
    const min = priceMin ? Number(priceMin) : 0;
    const max = priceMax ? Number(priceMax) : null;
    const label = max != null && !Number.isNaN(max)
      ? `$${min.toLocaleString()} – $${max.toLocaleString()}`
      : `From $${min.toLocaleString()}`;
    chips.push({ id: 'price', label });
  }

  if (params.get('availability') === 'in_stock') {
    chips.push({ id: 'availability:in_stock', label: 'In stock' });
  }

  return chips;
}

export function removeFilterChip(searchParams: { toString(): string }, chipId: string): string {
  const params = new URLSearchParams(searchParams.toString());
  params.delete('page');

  if (chipId === 'price') {
    params.delete('priceMin');
    params.delete('priceMax');
    return params.toString();
  }

  if (chipId === 'availability:in_stock') {
    params.delete('availability');
    return params.toString();
  }

  const separator = chipId.indexOf(':');
  if (separator === -1) return params.toString();

  const key = chipId.slice(0, separator);
  const value = chipId.slice(separator + 1);
  if (!key || !value) return params.toString();

  const remaining = splitParamList(params.get(key)).filter((entry) => entry !== value);
  if (remaining.length > 0) {
    params.set(key, remaining.join(','));
  } else {
    params.delete(key);
  }

  return params.toString();
}
