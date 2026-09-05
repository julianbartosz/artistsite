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
