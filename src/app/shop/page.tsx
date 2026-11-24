import { Suspense } from 'react';
import { getSiteContent } from '@/lib/site-content';
import { SearchService } from '@/lib/search-recommendations';
import { parseProductSearchParams, stableSearchParamsKey } from '@/lib/search-params';
import ShopPageClient from './ShopPageClient';

export const dynamic = 'force-dynamic';

type RawSearchParams = Record<string, string | string[] | undefined>;

function toURLSearchParams(raw: RawSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else if (typeof value === 'string') {
      params.set(key, value);
    }
  }
  return params;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const urlParams = toURLSearchParams(await searchParams);
  const { query, page, limit, sortBy, filters } = parseProductSearchParams(urlParams);
  const initialSearchParamsKey = stableSearchParamsKey(urlParams);

  const [pageContent, initialResults] = await Promise.all([
    getSiteContent('shop'),
    SearchService.searchProducts(query, filters, sortBy, page, limit),
  ]);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-muted flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      }
    >
      <ShopPageClient
        initialPageContent={pageContent}
        initialResults={initialResults}
        initialSearchParamsKey={initialSearchParamsKey}
      />
    </Suspense>
  );
}
