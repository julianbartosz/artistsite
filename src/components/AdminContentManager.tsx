'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import RichTextEditor from '@/components/RichTextEditor';
import { ChevronLeft } from 'lucide-react';
import GalleryField from '@/components/admin/GalleryField';
import MediaImageField from '@/components/admin/MediaImageField';
import MediaThumb from '@/components/admin/MediaThumb';
import ProductPurchaseOptionsFields from '@/components/admin/ProductPurchaseOptionsFields';
import {
  CategorySelectField,
  IntegerField,
  MoneyField,
  TagInput,
} from '@/components/admin/StudioFormFields';
import { useUnsavedChangesGuard } from '@/components/admin/useUnsavedChangesGuard';
import type { PostMediaItem } from '@/lib/admin-content';
import { POST_PROCESS_STAGES } from '@/lib/admin-content';
import { formatPrice, normalizeShipping, PRODUCT_IMAGE_FALLBACK } from '@/lib/commerce';
import { isVideoUrl } from '@/lib/image-variant-url';
import type { PortfolioCategory } from '@/lib/site-content-shared';

const DEFAULT_PRODUCT_CATEGORIES = [
  'Originals',
  'Prints',
  'Postcards',
  'Paintings',
  'Drawings',
  'Mixed Media',
  'Commissions',
  'Books',
];

type Section = 'products' | 'posts' | 'artworks';

interface AdminContentManagerProps {
  section: Section;
}

const SECTION_INTRO: Record<Section, { title: string; body: string }> = {
  products: {
    title: 'Shop products',
    body: 'Listings collectors can buy online. Stock, price, and shipping live here. Portfolio pieces are separate showcases unless you also create a matching product.',
  },
  artworks: {
    title: 'Portfolio pieces',
    body: 'Gallery works for browsing and inquiry. Mark Available when collectors can inquire — selling online still needs a product under Products.',
  },
  posts: {
    title: 'Updates',
    body: 'Studio posts (short captions) and journal posts (longer writing) appear on your public Updates feed.',
  },
};

const blankProduct = {
  title: '', description: '', price: '' as number | '', currency: 'USD', category: 'Originals', medium: '', dimensions: '', year: new Date().getFullYear(),
  availability: 'available', featured: false, images: { thumbnail: '', gallery: [] as string[] }, tags: [] as string[],
  shipping: { domestic: 0, international: 0, domesticEnabled: true, internationalEnabled: false },
  specifications: { framed: false, signed: true, certificate: false },
  edition: null as null | { total: number; remaining: number },
  variants: undefined as undefined | { sizes?: unknown[]; framing?: unknown[]; materials?: unknown[] },
  customizations: [] as unknown[],
  commissionInfo: null as null | {
    available: boolean;
    estimatedDays: number;
    priceRange: { min: number; max: number };
    requiresConsultation: boolean;
  },
};

const blankPost = {
  title: '', excerpt: '', content: '<p></p>', slug: '', publishedAt: new Date().toISOString().slice(0, 10), tags: [] as string[], isDraft: true, featured: false, coverImage: '', author: 'Artist',
  format: 'short', visibility: 'public', media: [] as PostMediaItem[], audienceEmails: [] as string[],
  relatedProductId: '', relatedArtworkSlug: '', pullQuote: '', location: '', processStage: '',
};

const blankArtwork = {
  title: '', description: '', medium: '', dimensions: '', year: String(new Date().getFullYear()), category: [] as string[], featured: false, available: true, price: '', images: { main: '', thumbnail: '', gallery: [] as string[] }, content: '<p></p>',
};

function hydrateProductForm(item: any) {
  return {
    ...blankProduct,
    ...item,
    shipping: normalizeShipping(item?.shipping),
    tags: Array.isArray(item?.tags) ? item.tags : [],
    specifications: {
      framed: Boolean(item?.specifications?.framed),
      signed: item?.specifications?.signed ?? true,
      certificate: Boolean(item?.specifications?.certificate),
    },
    edition: item?.edition?.total ? item.edition : null,
  };
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function extractApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const record = data as { error?: unknown; details?: unknown };
  if (Array.isArray(record.details) && record.details.length > 0) {
    const first = record.details[0] as { message?: unknown };
    if (typeof first?.message === 'string' && first.message.trim()) {
      return first.message.trim();
    }
  }
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim();
  }
  return fallback;
}

function hydratePostForm(item: any) {
  return {
    ...blankPost,
    ...item,
    publishedAt: item.publishedAt?.slice(0, 10) || blankPost.publishedAt,
    media: Array.isArray(item.media) ? item.media : [],
    audienceEmails: Array.isArray(item.audienceEmails) ? item.audienceEmails : [],
    relatedProductId: item.relatedProductId || '',
    relatedArtworkSlug: item.relatedArtworkSlug || '',
    pullQuote: item.pullQuote || '',
    location: item.location || '',
    processStage: item.processStage || '',
  };
}

/**
 * The photos/videos an item shows publicly, in order.
 * Preserves `gallery`'s explicit order when `cover` is already in `gallery` (e.g. a video-first product
 * whose `thumbnail` points to the first still photo), while still prepending `cover` for legacy records.
 */
function orderedPhotos(cover: string | undefined, gallery: string[] | undefined): string[] {
  const trimmedCover = typeof cover === 'string' ? cover.trim() : '';
  const cleanedGallery = (Array.isArray(gallery) ? gallery : [])
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter((url, index, all) => Boolean(url) && url !== PRODUCT_IMAGE_FALLBACK && all.indexOf(url) === index);

  if (!trimmedCover || trimmedCover === PRODUCT_IMAGE_FALLBACK || cleanedGallery.includes(trimmedCover)) {
    return cleanedGallery;
  }
  return [trimmedCover, ...cleanedGallery];
}

function preferredStillUrl(urls: string[]): string {
  return urls.find((url) => !isVideoUrl(url)) || urls[0] || '';
}

function formatListDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const contentFetcher = async (url: string) => {
  const res = await fetch(url, url.includes('site-content') ? { cache: 'no-store' } : undefined);
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  return res.json();
};

const contentSwrOptions = { revalidateOnFocus: false, dedupingInterval: 10_000 } as const;

export function AdminContentManager({ section }: AdminContentManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: globalMutate } = useSWRConfig();
  const createIntentConsumed = useRef(false);

  const [productForm, setProductForm] = useState<any>(blankProduct);
  const [postForm, setPostForm] = useState<any>(blankPost);
  const [artworkForm, setArtworkForm] = useState<any>(blankArtwork);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inventoryByProduct, setInventoryByProduct] = useState<Record<string, { currentStock: number; stockStatus: string }>>({});
  const [productStock, setProductStock] = useState<number | ''>(1);
  const [stockTouched, setStockTouched] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');
  const editorRef = useRef<HTMLFormElement>(null);
  const revealEditorOnOpen = useRef(false);

  const editorOpen = isCreating || Boolean(selectedId);
  // Lazy-load secondary catalogs only when cross-link pickers or deep-link intents need them.
  const needsProducts = section === 'products'
    || Boolean(searchParams.get('fromProduct'))
    || (section === 'posts' && editorOpen);
  const needsPosts = section === 'posts';
  const needsArtworks = section === 'artworks'
    || Boolean(searchParams.get('fromArtwork'))
    || (section === 'posts' && editorOpen);
  const needsSiteContent = (section === 'artworks' || section === 'posts') && editorOpen;

  const {
    data: productData,
    error: productError,
    isLoading: productsLoading,
    mutate: mutateProducts,
  } = useSWR(needsProducts ? '/api/admin/products' : null, contentFetcher, contentSwrOptions);
  const {
    data: postData,
    error: postError,
    isLoading: postsLoading,
    mutate: mutatePosts,
  } = useSWR(needsPosts ? '/api/admin/posts' : null, contentFetcher, contentSwrOptions);
  const {
    data: artworkData,
    error: artworkError,
    isLoading: artworksLoading,
    mutate: mutateArtworks,
  } = useSWR(needsArtworks ? '/api/admin/artworks' : null, contentFetcher, contentSwrOptions);
  const {
    data: siteContentData,
    mutate: mutateSiteContent,
  } = useSWR(needsSiteContent ? '/api/admin/site-content' : null, contentFetcher, contentSwrOptions);

  const products: any[] = useMemo(() => productData?.products || [], [productData]);
  const posts: any[] = useMemo(
    () => (Array.isArray(postData) ? postData : postData?.posts || []),
    [postData],
  );
  const artworks: any[] = useMemo(() => artworkData?.artworks || [], [artworkData]);
  const collectors = useMemo(
    () => (Array.isArray(postData?.collectors) ? postData.collectors : []),
    [postData],
  );
  const artistName = siteContentData?.identity?.siteName || 'Artist';
  const portfolioCategories: PortfolioCategory[] = Array.isArray(siteContentData?.portfolio?.categories)
    ? siteContentData.portfolio.categories
    : [];

  // Only gate the list on the active section's primary dataset so secondary pickers never block initial paint.
  const sectionError = Boolean(
    (section === 'products' && productError)
    || (section === 'posts' && postError)
    || (section === 'artworks' && artworkError),
  );
  const sectionLoading = Boolean(
    (section === 'products' && productsLoading && !productData)
    || (section === 'posts' && postsLoading && !postData)
    || (section === 'artworks' && artworksLoading && !artworkData),
  );
  const loadState: 'loading' | 'ready' | 'error' = sectionError
    ? 'error'
    : sectionLoading
      ? 'loading'
      : 'ready';

  const productCategoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of [
      ...DEFAULT_PRODUCT_CATEGORIES,
      ...products.map((product) => (typeof product.category === 'string' ? product.category.trim() : '')),
    ]) {
      if (!entry) continue;
      const key = entry.toLowerCase();
      if (!seen.has(key)) seen.set(key, entry);
    }
    return Array.from(seen.values());
  }, [products]);

  const existingProductTags = useMemo(() => {
    const tags = new Set<string>();
    for (const product of products) {
      if (Array.isArray(product.tags)) {
        for (const tag of product.tags) {
          if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
        }
      }
    }
    return Array.from(tags);
  }, [products]);

  const existingPostTags = useMemo(() => {
    const tags = new Set<string>();
    for (const post of posts) {
      if (Array.isArray(post.tags)) {
        for (const tag of post.tags) {
          if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
        }
      }
    }
    return Array.from(tags);
  }, [posts]);

  const existingArtworkCategories = useMemo(() => {
    const categories = new Set<string>();
    for (const artwork of artworks) {
      if (Array.isArray(artwork.category)) {
        for (const entry of artwork.category) {
          if (typeof entry === 'string' && entry.trim() && entry.trim().toLowerCase() !== 'uncategorized') {
            categories.add(entry.trim());
          }
        }
      }
    }
    return Array.from(categories);
  }, [artworks]);

  const existingMediums = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of [...products, ...artworks]) {
      const value = typeof item?.medium === 'string' ? item.medium.trim() : '';
      if (!value) continue;
      const key = value.toLowerCase();
      if (!seen.has(key)) seen.set(key, value);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [products, artworks]);

  // If the artist opens a product before inventory finishes loading, hydrate real stock cleanly
  // without marking the form dirty or overwriting an intentional edit.
  useEffect(() => {
    if (section !== 'products' || !selectedId || isCreating || stockTouched) return;
    const loaded = inventoryByProduct[selectedId];
    if (!loaded || typeof loaded.currentStock !== 'number') return;
    if (productStock === loaded.currentStock) return;
    setProductStock(loaded.currentStock);
    setSavedSnapshot((prev) => {
      if (!prev) return prev;
      try {
        const parsed = JSON.parse(prev);
        return JSON.stringify({ ...parsed, stock: loaded.currentStock });
      } catch {
        return prev;
      }
    });
  }, [section, selectedId, isCreating, stockTouched, inventoryByProduct, productStock]);

  const currentSnapshot =
    section === 'products'
      ? JSON.stringify({ form: productForm, stock: productStock })
      : section === 'posts'
        ? JSON.stringify(postForm)
        : JSON.stringify(artworkForm);
  const isDirty = Boolean((selectedId || isCreating) && savedSnapshot && currentSnapshot !== savedSnapshot);

  useUnsavedChangesGuard(isDirty);

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  }

  function closeEditor() {
    if (!confirmDiscardIfDirty()) return;
    setSelectedId(null);
    setIsCreating(false);
    setSavedSnapshot('');
    setMessage(null);
  }

  // Inventory is only needed on the products section; load after product catalog settles.
  useEffect(() => {
    if (section !== 'products') return;
    void loadInventory(products.map((product: { id: string }) => product.id));
  }, [section, products]);

  // When an item is opened, bring the editor to the top if it is off-screen
  // (on phones and tablets it takes the place of the list).
  const openEditorKey = isCreating ? 'new' : selectedId;
  useEffect(() => {
    if (!openEditorKey || !revealEditorOnOpen.current) return;
    revealEditorOnOpen.current = false;
    const node = editorRef.current;
    if (!node) return;
    const { top } = node.getBoundingClientRect();
    if (top < 0 || top > window.innerHeight / 2) node.scrollIntoView({ block: 'start' });
  }, [openEditorKey]);

  function startNewProduct(skipConfirm = false) {
    if (!skipConfirm && !confirmDiscardIfDirty()) return;
    revealEditorOnOpen.current = true;
    setSelectedId(null);
    setIsCreating(true);
    setProductForm(blankProduct);
    setProductStock(1);
    setStockTouched(false);
    setSavedSnapshot(JSON.stringify({ form: blankProduct, stock: 1 }));
    setMessage(null);
  }

  function startNewPost(skipConfirm = false) {
    if (!skipConfirm && !confirmDiscardIfDirty()) return;
    revealEditorOnOpen.current = true;
    const nextPost = { ...blankPost, author: artistName || 'Artist' };
    setSelectedId(null);
    setIsCreating(true);
    setPostForm(nextPost);
    setSavedSnapshot(JSON.stringify(nextPost));
    setMessage(null);
  }

  function startNewArtwork(skipConfirm = false) {
    if (!skipConfirm && !confirmDiscardIfDirty()) return;
    revealEditorOnOpen.current = true;
    setSelectedId(null);
    setIsCreating(true);
    setArtworkForm(blankArtwork);
    setSavedSnapshot(JSON.stringify(blankArtwork));
    setMessage(null);
  }

  function duplicateCurrentProduct(sourceTitle?: string) {
    if (!confirmDiscardIfDirty()) return;
    revealEditorOnOpen.current = true;
    const { id: _id, slug: _slug, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = productForm;
    const cloned = hydrateProductForm({
      ...rest,
      title: '',
      description: '',
      featured: false,
      images: { thumbnail: '', gallery: [] },
    });
    const nextStock = typeof productStock === 'number' ? productStock : 1;
    setSelectedId(null);
    setIsCreating(true);
    setProductForm(cloned);
    setProductStock(nextStock);
    setStockTouched(true);
    setSavedSnapshot(JSON.stringify({ form: blankProduct, stock: 1 }));
    setMessage({
      type: 'success',
      text: sourceTitle
        ? `Copied settings from “${sourceTitle}” — add a title and photos, then save.`
        : 'Copied settings — add a title and photos, then save.',
    });
  }

  function duplicateCurrentArtwork(sourceTitle?: string) {
    if (!confirmDiscardIfDirty()) return;
    revealEditorOnOpen.current = true;
    const { slug: _slug, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = artworkForm;
    const cloned = {
      ...blankArtwork,
      ...rest,
      title: '',
      description: '',
      featured: false,
      images: { main: '', thumbnail: '', gallery: [] },
      content: '<p></p>',
    };
    setSelectedId(null);
    setIsCreating(true);
    setArtworkForm(cloned);
    setSavedSnapshot(JSON.stringify(blankArtwork));
    setMessage({
      type: 'success',
      text: sourceTitle
        ? `Copied details from “${sourceTitle}” — add a title and photos, then save.`
        : 'Copied details — add a title and photos, then save.',
    });
  }

  function startProductFromArtwork(artwork: any) {
    const photos = orderedPhotos(artwork?.images?.main || artwork?.images?.thumbnail, artwork?.images?.gallery);
    const parsedYear = Number.parseInt(String(artwork?.year ?? ''), 10);
    const parsedPrice = typeof artwork?.price === 'string'
      ? Number.parseFloat(artwork.price.replace(/[^0-9.]/g, ''))
      : Number.NaN;
    const tags = Array.isArray(artwork?.category)
      ? artwork.category.filter((entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0 && entry.trim().toLowerCase() !== 'uncategorized')
      : [];
    const prefilled = hydrateProductForm({
      ...blankProduct,
      title: artwork?.title || '',
      description: artwork?.description || '',
      medium: artwork?.medium || blankProduct.medium,
      dimensions: artwork?.dimensions || '',
      year: Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= 2100 ? parsedYear : new Date().getFullYear(),
      price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : '',
      images: {
        thumbnail: photos[0] || '',
        gallery: photos,
      },
      tags,
    });
    revealEditorOnOpen.current = true;
    setSelectedId(null);
    setIsCreating(true);
    setProductForm(prefilled);
    setProductStock(1);
    setStockTouched(false);
    setSavedSnapshot(JSON.stringify({ form: blankProduct, stock: 1 }));
    setMessage({
      type: 'success',
      text: `Prefilled from portfolio piece “${artwork?.title || 'Untitled'}” — set a price and shipping, then save.`,
    });
  }

  function startArtworkFromProduct(product: any) {
    const photos = orderedPhotos(product?.images?.thumbnail, product?.images?.gallery);
    const main = preferredStillUrl(photos);
    const categories = [
      ...(typeof product?.category === 'string' && product.category.trim() ? [product.category.trim()] : []),
      ...(Array.isArray(product?.tags) ? product.tags : []),
    ]
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .filter((entry, index, list) => list.findIndex((other) => other.toLowerCase() === entry.toLowerCase()) === index);
    const numericPrice = coerceNumber(product?.price, 0);
    const prefilled = {
      ...blankArtwork,
      title: product?.title || '',
      description: product?.description || '',
      medium: product?.medium || '',
      dimensions: product?.dimensions || '',
      year: product?.year ? String(product.year) : String(new Date().getFullYear()),
      category: categories,
      available: product?.availability === 'available',
      price: numericPrice > 0 ? formatPrice(numericPrice, product?.currency || 'USD') : '',
      images: {
        main,
        thumbnail: main,
        gallery: photos,
      },
      content: '<p></p>',
    };
    revealEditorOnOpen.current = true;
    setSelectedId(null);
    setIsCreating(true);
    setArtworkForm(prefilled);
    setSavedSnapshot(JSON.stringify(blankArtwork));
    setMessage({
      type: 'success',
      text: `Prefilled from shop product “${product?.title || 'Untitled'}” — review details, then save.`,
    });
  }

  useEffect(() => {
    createIntentConsumed.current = false;
    setIsCreating(false);
    setSelectedId(null);
    setSavedSnapshot('');
    setMessage(null);
  }, [section]);

  function replaceAdminUrlWithoutReload(params: URLSearchParams) {
    const query = params.toString();
    const nextUrl = query ? `/admin?${query}` : '/admin';
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', nextUrl);
    } else {
      router.replace(nextUrl, { scroll: false });
    }
  }

  useEffect(() => {
    const requestedProduct = searchParams.get('product');
    if (section === 'products' && requestedProduct && !createIntentConsumed.current && loadState === 'ready') {
      const match = products.find((product: any) => product.id === requestedProduct || product.slug === requestedProduct);
      if (match) {
        createIntentConsumed.current = true;
        const hydrated = hydrateProductForm(match);
        const nextStock = inventoryByProduct[match.id]?.currentStock ?? 1;
        revealEditorOnOpen.current = true;
        setSelectedId(match.id);
        setIsCreating(false);
        setProductForm(hydrated);
        setProductStock(nextStock);
        setStockTouched(false);
        setSavedSnapshot(JSON.stringify({ form: hydrated, stock: nextStock }));
        setMessage(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('product');
        replaceAdminUrlWithoutReload(params);
        return;
      }
    }
    const fromArtwork = searchParams.get('fromArtwork');
    if (section === 'products' && fromArtwork && !createIntentConsumed.current && loadState === 'ready') {
      const match = artworks.find((artwork) => artwork.slug === fromArtwork);
      if (match) {
        createIntentConsumed.current = true;
        startProductFromArtwork(match);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('fromArtwork');
        replaceAdminUrlWithoutReload(params);
        return;
      }
    }
    const fromProduct = searchParams.get('fromProduct');
    if (section === 'artworks' && fromProduct && !createIntentConsumed.current && loadState === 'ready') {
      const match = products.find((product) => product.id === fromProduct || product.slug === fromProduct);
      if (match) {
        createIntentConsumed.current = true;
        startArtworkFromProduct(match);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('fromProduct');
        replaceAdminUrlWithoutReload(params);
        return;
      }
    }
    if (searchParams.get('create') !== '1' || createIntentConsumed.current) return;
    createIntentConsumed.current = true;
    if (section === 'products') startNewProduct(true);
    else if (section === 'posts') startNewPost(true);
    else startNewArtwork(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    replaceAdminUrlWithoutReload(params);
  }, [searchParams, section, router, artworks, products, loadState, inventoryByProduct]);

  async function loadInventory(productIds: string[]) {
    if (productIds.length === 0) {
      setInventoryByProduct({});
      return;
    }
    try {
      const response = await fetch(`/api/inventory?productIds=${encodeURIComponent(productIds.join(','))}`);
      const data = await response.json();
      if (response.ok && data.inventories) {
        setInventoryByProduct(data.inventories);
      }
    } catch {
      setInventoryByProduct({});
    }
  }

  async function refreshContent() {
    await Promise.all([
      needsProducts ? mutateProducts() : Promise.resolve(),
      needsPosts ? mutatePosts() : Promise.resolve(),
      needsArtworks ? mutateArtworks() : Promise.resolve(),
      needsSiteContent ? mutateSiteContent() : Promise.resolve(),
    ]);
  }

  function retryLoad() {
    void refreshContent();
  }

  async function saveStock(productId: string, stock: number) {
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bulk_update',
        updates: [{ productId, currentStock: stock }],
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(extractApiError(data, 'Could not save stock count'));
    }
  }

  function evictInventoryCaches() {
    void Promise.all([
      globalMutate('/api/inventory', undefined, { revalidate: true }),
      globalMutate('/api/inventory/alerts', undefined, { revalidate: true }),
      globalMutate('/api/admin/stats', undefined, { revalidate: true }),
      globalMutate(
        (key) => typeof key === 'string' && key.startsWith('/api/inventory?productIds='),
        undefined,
        { revalidate: true },
      ),
    ]);
  }

  async function save(
    endpoint: string,
    method: 'POST' | 'PUT',
    body: unknown,
    options?: { productId?: string; stock?: number; syncStockAfterSave?: boolean; successText?: string },
  ) {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(extractApiError(data, 'Save failed'));
      const savedProductId = data.product?.id || options?.productId;
      if (savedProductId && typeof options?.stock === 'number' && options?.syncStockAfterSave !== false) {
        await saveStock(savedProductId, options.stock);
      }
      if (section === 'products') {
        evictInventoryCaches();
      }
      const savedId =
        data.product?.id
        || data.artwork?.slug
        || data.post?.slug
        || options?.productId
        || selectedId;
      await refreshContent();
      if (section === 'products') {
        const nextIds = Array.from(new Set([...products.map((p: { id: string }) => p.id), ...(savedProductId ? [savedProductId] : [])]));
        await loadInventory(nextIds);
      }
      let nextSnapshot = currentSnapshot;
      if (section === 'products' && data.product) {
        const hydrated = hydrateProductForm(data.product);
        const nextStock = typeof options?.stock === 'number' ? options.stock : productStock;
        setProductForm(hydrated);
        setProductStock(nextStock);
        setStockTouched(false);
        nextSnapshot = JSON.stringify({ form: hydrated, stock: nextStock });
      } else if (section === 'artworks' && data.artwork) {
        setArtworkForm(data.artwork);
        nextSnapshot = JSON.stringify(data.artwork);
      } else if (section === 'posts' && data.post) {
        const hydratedPost = hydratePostForm({
          ...data.post,
          audienceEmails: Array.isArray(postForm.audienceEmails) ? postForm.audienceEmails : [],
        });
        setPostForm(hydratedPost);
        nextSnapshot = JSON.stringify(hydratedPost);
      }
      setSelectedId(savedId || null);
      setIsCreating(false);
      setSavedSnapshot(nextSnapshot);
      setMessage({ type: 'success', text: options?.successText || 'Saved' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function remove(endpoint: string) {
    if (!window.confirm('Delete this item?')) return;
    setSaving(true);
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Delete failed');
      if (section === 'products') {
        evictInventoryCaches();
      }
      await refreshContent();
      setSelectedId(null);
      setIsCreating(false);
      setSavedSnapshot('');
      setMessage({ type: 'success', text: 'Deleted.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Delete failed' });
    } finally {
      setSaving(false);
    }
  }

  const intro = SECTION_INTRO[section];

  if (section === 'products') {
    const selectedProduct = products.find((product) => product.id === selectedId);
    const showEditor = Boolean(selectedProduct) || isCreating;
    return (
      <div className="space-y-4">
        <SectionIntro title={intro.title} body={intro.body} collapsedOnSmall={showEditor} />
        {!showEditor && <FormMessage message={message} />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContentList
          title="Products"
          items={products}
          loadState={loadState}
          onRetry={retryLoad}
          hiddenOnSmall={showEditor}
          selectedKey={selectedId}
          labelKey="title"
          getThumb={(item) => preferredStillUrl(orderedPhotos(item.images?.thumbnail, item.images?.gallery))}
          getMeta={(item) => [formatPrice(coerceNumber(item.price, 0), item.currency || 'USD'), item.category].filter(Boolean).join(' · ')}
          searchable
          searchPlaceholder="Search title, category, tags…"
          emptyTitle="No products yet"
          emptyHint="Add your first shop listing so collectors can check out."
          onNew={() => startNewProduct()}
          onSelect={(item) => {
            if (item.id !== selectedId && !confirmDiscardIfDirty()) return;
            const hydrated = hydrateProductForm(item);
            const nextStock = inventoryByProduct[item.id]?.currentStock ?? 1;
            revealEditorOnOpen.current = true;
            setSelectedId(item.id);
            setIsCreating(false);
            setProductForm(hydrated);
            setProductStock(nextStock);
            setStockTouched(false);
            setSavedSnapshot(JSON.stringify({ form: hydrated, stock: nextStock }));
            setMessage(null);
          }}
          badge={(item) => {
            const inv = inventoryByProduct[item.id];
            const status = inv?.stockStatus;
            const qty = inv?.currentStock;
            if (item.availability === 'sold') return <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Sold</span>;
            if (item.availability === 'commissioned') return <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">Commission</span>;
            if (status === 'out_of_stock') return <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Out of stock</span>;
            if (status === 'low_stock') {
              return (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  {typeof qty === 'number' ? `Low · ${qty} left` : 'Low stock'}
                </span>
              );
            }
            if (typeof qty === 'number') {
              return <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{qty} in stock</span>;
            }
            return null;
          }}
        />
        {showEditor ? (
        <EditorShell
          key={`product:${openEditorKey || 'none'}`}
          editorRef={editorRef}
          heading={selectedProduct ? 'Editing product' : 'New product'}
          backLabel="All products"
          onBack={closeEditor}
          liveHref={selectedProduct ? `/shop/${encodeURIComponent(selectedProduct.id)}` : undefined}
          message={message}
          saving={saving}
          isDirty={isDirty}
          isCreating={isCreating}
          onDuplicate={selectedProduct ? () => duplicateCurrentProduct(selectedProduct.title) : undefined}
          extraActions={selectedProduct ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (!confirmDiscardIfDirty()) return;
                router.push(`/admin?tab=portfolio&fromProduct=${encodeURIComponent(selectedProduct.id)}`);
              }}
              className="min-h-10 shrink-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Show in portfolio
            </button>
          ) : undefined}
          onDelete={selectedProduct ? () => remove(`/api/admin/products/${selectedProduct.id}`) : undefined}
          onSubmit={() => {
          if (!productForm.title.trim()) {
            setMessage({ type: 'error', text: 'Enter a title before saving.' });
            return;
          }
          if (productForm.availability !== 'commissioned' && productForm.price === '') {
            setMessage({ type: 'error', text: 'Enter a price before saving (use 0 for a free item).' });
            return;
          }
          const stockCount = Math.max(0, Math.floor(coerceNumber(productStock, 0)));
          const shipping = normalizeShipping(productForm.shipping);
          const normalizedPayload = {
            ...productForm,
            price: coerceNumber(productForm.price, 0),
            year: Math.floor(coerceNumber(productForm.year, new Date().getFullYear())),
            shipping: {
              domesticEnabled: shipping.domesticEnabled,
              internationalEnabled: shipping.internationalEnabled,
              domestic: shipping.domesticEnabled ? coerceNumber(productForm.shipping?.domestic, 0) : 0,
              international: shipping.internationalEnabled ? coerceNumber(productForm.shipping?.international, 0) : 0,
            },
            edition: productForm.edition?.total
              ? {
                  total: productForm.edition.total,
                  remaining: Math.min(productForm.edition.total, stockCount),
                }
              : null,
            ...(!selectedProduct ? { initialStock: stockCount } : {}),
          };
          save(
            selectedProduct ? `/api/admin/products/${selectedProduct.id}` : '/api/admin/products',
            selectedProduct ? 'PUT' : 'POST',
            normalizedPayload,
            {
              productId: selectedProduct?.id,
              stock: stockCount,
              syncStockAfterSave: Boolean(selectedProduct),
            },
          );
        }}>
          <div className="space-y-4">
            <TextField label="Title" value={productForm.title} onChange={(value) => setProductForm({ ...productForm, title: value })} placeholder="e.g. Sunlit Garden Study" />
            <GalleryField
              accept="media"
              label="Photos & video"
              firstItemLabel="Cover"
              value={orderedPhotos(productForm.images?.thumbnail, productForm.images?.gallery).map((url) => ({
                url,
                type: isVideoUrl(url) ? 'video' : 'image',
              }))}
              onChange={(media) => {
                const urls = media.map((entry) => entry.url);
                setProductForm({
                  ...productForm,
                  images: { ...productForm.images, thumbnail: preferredStillUrl(urls), gallery: urls },
                });
              }}
              help="Add photos, GIFs, or short videos. The first item shows first in the shop; use the arrows to reorder."
            />
            <TextArea label="Description" value={productForm.description} onChange={(value) => setProductForm({ ...productForm, description: value })} placeholder="Tell collectors about this piece, paper or canvas details, and story. Blank lines create paragraphs." />
          </div>

          <div className="space-y-4 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pricing &amp; details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MoneyField
                label="Price"
                value={productForm.price}
                onChange={(value) => setProductForm({ ...productForm, price: value })}
                placeholder="0.00"
              />
              <CategorySelectField
                label="Category"
                value={productForm.category || ''}
                options={productCategoryOptions}
                onChange={(value) => setProductForm({ ...productForm, category: value })}
              />
              <CategorySelectField
                label="Medium"
                value={productForm.medium || ''}
                options={existingMediums}
                onChange={(value) => setProductForm({ ...productForm, medium: value })}
                emptyLabel="Select medium…"
                addOptionLabel="+ Add new medium…"
                customPlaceholder="e.g. Acrylic on canvas, Watercolor"
                customInputAriaLabel="New medium name"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField
                label="Dimensions"
                value={productForm.dimensions}
                onChange={(value) => setProductForm({ ...productForm, dimensions: value })}
                placeholder='e.g. 8" × 10"'
              />
              <IntegerField
                label="Year"
                value={productForm.year}
                min={1900}
                max={2100}
                onChange={(value) => setProductForm({ ...productForm, year: value })}
              />
              <SelectField
                label="Availability"
                value={productForm.availability}
                options={['available', 'sold', 'reserved', 'commissioned']}
                optionLabels={{
                  available: 'Available',
                  sold: 'Sold',
                  reserved: 'Reserved',
                  commissioned: 'Commission only',
                }}
                onChange={(value) => setProductForm({ ...productForm, availability: value })}
              />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <CheckboxField label="Featured" checked={Boolean(productForm.featured)} onChange={(checked) => setProductForm({ ...productForm, featured: checked })} />
              <CheckboxField
                label="Signed"
                checked={Boolean(productForm.specifications?.signed)}
                onChange={(checked) => setProductForm({ ...productForm, specifications: { ...productForm.specifications, signed: checked } })}
              />
              <CheckboxField
                label="Certificate included"
                checked={Boolean(productForm.specifications?.certificate)}
                onChange={(checked) => setProductForm({ ...productForm, specifications: { ...productForm.specifications, certificate: checked } })}
              />
              <CheckboxField
                label="Framed"
                checked={Boolean(productForm.specifications?.framed)}
                onChange={(checked) => setProductForm({ ...productForm, specifications: { ...productForm.specifications, framed: checked } })}
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Inventory &amp; edition</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <IntegerField
                label="Quantity in stock"
                value={productStock}
                min={0}
                onChange={(parsed) => {
                  setStockTouched(true);
                  const numericStock = parsed === '' ? 0 : Math.max(0, parsed);
                  setProductStock(parsed === '' ? '' : numericStock);
                  if (productForm.edition?.total) {
                    setProductForm({
                      ...productForm,
                      edition: {
                        total: productForm.edition.total,
                        remaining: Math.min(productForm.edition.total, numericStock),
                      },
                    });
                  }
                }}
                help={
                  productForm.availability === 'commissioned'
                    ? 'Optional for commission-only listings — collectors submit a request instead of checking out from stock.'
                    : 'How many copies are ready to sell right now.'
                }
              />
              <div className="space-y-2 pt-1">
                <CheckboxField
                  label="Limited edition (numbered run)"
                  checked={Boolean(productForm.edition?.total)}
                  onChange={(checked) => {
                    if (!checked) {
                      setProductForm({ ...productForm, edition: null });
                      return;
                    }
                    const stockCount = Math.max(1, Math.floor(coerceNumber(productStock, 1)));
                    setProductForm({
                      ...productForm,
                      edition: { total: Math.max(stockCount, 10), remaining: stockCount },
                    });
                  }}
                />
                {productForm.edition?.total ? (
                  <IntegerField
                    label="Total edition size"
                    compact
                    min={1}
                    value={productForm.edition.total}
                    onChange={(total) => {
                      const nextTotal = total === '' ? 1 : Math.max(1, total);
                      const stockCount = Math.max(0, Math.floor(coerceNumber(productStock, 0)));
                      setProductForm({
                        ...productForm,
                        edition: {
                          total: nextTotal,
                          remaining: Math.min(nextTotal, stockCount),
                        },
                      });
                    }}
                    help="Total prints in the numbered run (e.g. 25). Remaining copies follow quantity in stock."
                  />
                ) : (
                  <p className="text-xs text-gray-500">Turn on only for numbered limited editions (e.g. “10 of 25 remaining”).</p>
                )}
              </div>
            </div>
            {productForm.availability === 'available' && (productStock === 0 || productStock === '') && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Quantity is 0 — collectors will see this item as Sold out until you restock.
              </p>
            )}
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Shipping</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                <CheckboxField
                  label="Ship within the US"
                  checked={productForm.shipping?.domesticEnabled !== false}
                  onChange={(checked) => setProductForm({
                    ...productForm,
                    shipping: { ...productForm.shipping, domesticEnabled: checked },
                  })}
                />
                {productForm.shipping?.domesticEnabled !== false ? (
                  <MoneyField
                    label="US shipping cost"
                    compact
                    value={productForm.shipping?.domestic ?? 0}
                    onChange={(value) => setProductForm({
                      ...productForm,
                      shipping: { ...productForm.shipping, domestic: value === '' ? 0 : value },
                    })}
                    help="Enter 0 for free US shipping."
                  />
                ) : (
                  <p className="text-xs text-gray-500">US shipping is turned off for this item.</p>
                )}
              </div>
              <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                <CheckboxField
                  label="Ship internationally"
                  checked={productForm.shipping?.internationalEnabled !== false}
                  onChange={(checked) => setProductForm({
                    ...productForm,
                    shipping: { ...productForm.shipping, internationalEnabled: checked },
                  })}
                />
                {productForm.shipping?.internationalEnabled !== false ? (
                  <MoneyField
                    label="International shipping cost"
                    compact
                    value={productForm.shipping?.international ?? 0}
                    onChange={(value) => setProductForm({
                      ...productForm,
                      shipping: { ...productForm.shipping, international: value === '' ? 0 : value },
                    })}
                    help="Enter 0 for free international shipping."
                  />
                ) : (
                  <p className="text-xs text-gray-500">International checkout is hidden for this item.</p>
                )}
              </div>
            </div>
            {productForm.shipping?.domesticEnabled === false && productForm.shipping?.internationalEnabled === false && (
              <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                Both shipping options are off — collectors will see this item as local pickup / studio arrangement with no shipping fee.
              </p>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <TagInput
              label="Tags"
              value={Array.isArray(productForm.tags) ? productForm.tags : []}
              onChange={(tags) => setProductForm({ ...productForm, tags })}
              suggestions={existingProductTags}
              placeholder="e.g. botanical, oil, landscape"
              help="Type a tag and press Enter or comma to add multiple tags."
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <ProductPurchaseOptionsFields
              value={{
                variants: productForm.variants,
                customizations: productForm.customizations,
                commissionInfo: productForm.commissionInfo,
              }}
              onChange={(next) => setProductForm({
                ...productForm,
                variants: next.variants,
                customizations: next.customizations,
                commissionInfo: next.commissionInfo,
              })}
            />
          </div>
        </EditorShell>
        ) : (
          <EditorPlaceholder
            title="Select or create a product"
            body="Choose a listing on the left, or add something collectors can buy."
            buttonLabel="Add product"
            onNew={startNewProduct}
          />
        )}
      </div>
      </div>
    );
  }

  if (section === 'posts') {
    const selectedPost = posts.find((post) => post.slug === selectedId);
    const isShort = postForm.format !== 'article';
    const isPublished = Boolean(selectedPost && !postForm.isDraft);
    const showEditor = Boolean(selectedPost) || isCreating;

    function submitPost(nextIsDraft: boolean) {
      if (!nextIsDraft) {
        if (postForm.visibility === 'private' && (!Array.isArray(postForm.audienceEmails) || postForm.audienceEmails.length === 0)) {
          setMessage({ type: 'error', text: 'Add at least one collector email before publishing a private update.' });
          return;
        }
        if (isShort) {
          const hasMedia = Array.isArray(postForm.media) && postForm.media.length > 0;
          const hasCaption = typeof postForm.excerpt === 'string' && postForm.excerpt.trim().length >= 3;
          if (!hasMedia && !hasCaption) {
            setMessage({ type: 'error', text: 'Add a photo, video, or caption before publishing.' });
            return;
          }
        } else {
          const title = typeof postForm.title === 'string' ? postForm.title.trim() : '';
          if (title.length < 3 || title.toLowerCase() === 'untitled') {
            setMessage({ type: 'error', text: 'Add a title (at least 3 characters) before publishing.' });
            return;
          }
        }
      }
      const nextPayload = { ...postForm, isDraft: nextIsDraft };
      const successText = nextIsDraft
        ? (isPublished ? 'Moved back to drafts' : 'Draft saved')
        : (isPublished ? 'Changes saved' : 'Published');
      void save(
        selectedPost ? `/api/admin/posts/${selectedPost.slug}` : '/api/admin/posts',
        selectedPost ? 'PUT' : 'POST',
        nextPayload,
        { successText },
      );
    }

    return (
      <div className="space-y-4">
        <SectionIntro title={intro.title} body={intro.body} collapsedOnSmall={showEditor} />
        {!showEditor && <FormMessage message={message} />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContentList
          title="Updates"
          items={posts}
          loadState={loadState}
          onRetry={retryLoad}
          hiddenOnSmall={showEditor}
          getMeta={(item) => formatListDate(item.publishedAt)}
          selectedKey={selectedId}
          labelKey="title"
          getThumb={(item) => item.coverImage || item.media?.find((entry: PostMediaItem) => entry.type === 'image')?.url || ''}
          searchable
          searchPlaceholder="Search title, caption, tags…"
          emptyTitle="No updates yet"
          emptyHint="Share a studio note or journal post for your Updates feed."
          getLabel={(item) => item.title || item.excerpt || item.slug || 'Untitled update'}
          onNew={() => startNewPost()}
          onSelect={(item) => {
            if (item.slug !== selectedId && !confirmDiscardIfDirty()) return;
            const nextForm = hydratePostForm(item);
            revealEditorOnOpen.current = true;
            setSelectedId(item.slug);
            setIsCreating(false);
            setPostForm(nextForm);
            setSavedSnapshot(JSON.stringify(nextForm));
            setMessage(null);
          }}
          badge={(item) => (
            <span className="flex flex-wrap gap-1">
              {typeof item.views === 'number' && item.views > 0 && (
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{item.views} views</span>
              )}
              {item.visibility === 'private' && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Collectors</span>}
              {item.format === 'short' && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Studio</span>}
              {item.featured && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Featured</span>}
              {item.isDraft && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Draft</span>}
              {item.relatedOrderId && <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800">Order</span>}
            </span>
          )}
        />
        {showEditor ? (
        <EditorShell
          key={`post:${openEditorKey || 'none'}`}
          editorRef={editorRef}
          heading={!selectedPost ? 'New update' : selectedPost.isDraft ? 'Draft update (hidden from visitors)' : 'Published update'}
          backLabel="All updates"
          onBack={closeEditor}
          liveHref={selectedPost && !selectedPost.isDraft && selectedPost.visibility !== 'private' ? `/updates/${encodeURIComponent(selectedPost.slug)}` : undefined}
          message={message}
          saving={saving}
          isDirty={isDirty}
          isCreating={isCreating}
          onDelete={selectedPost ? () => remove(`/api/admin/posts/${selectedPost.slug}`) : undefined}
          onSubmit={() => submitPost(isPublished ? false : false)}
          primaryActions={isPublished ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => submitPost(true)}
                className="min-h-10 shrink-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Unpublish
              </button>
              <button
                type="submit"
                disabled={saving || !isDirty}
                className="btn-primary min-h-10 shrink-0 px-5 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={saving || (!isDirty && !isCreating)}
                onClick={() => submitPost(true)}
                className="min-h-10 shrink-0 rounded-md border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary min-h-10 shrink-0 px-5 text-sm disabled:opacity-50"
              >
                {saving ? 'Publishing…' : 'Publish'}
              </button>
            </>
          )}
        >
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-gray-700">Update type</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Update type">
              {([
                { value: 'short', title: 'Studio post', detail: 'Quick photo, video, and caption' },
                { value: 'article', title: 'Journal post', detail: 'Longer titled story or announcement' },
              ] as const).map((option) => {
                const active = (isShort ? 'short' : 'article') === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPostForm({ ...postForm, format: option.value })}
                    className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="block text-sm font-medium text-gray-900">{option.title}</span>
                    <span className="block text-xs text-gray-500">{option.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {!isShort && (
            <TextField
              label="Title"
              value={postForm.title}
              onChange={(value) => setPostForm({ ...postForm, title: value })}
              placeholder="e.g. Behind the scenes of my spring collection"
            />
          )}
          <GalleryField
            accept="media"
            label={isShort ? 'Photos and video' : 'Photos and video (optional)'}
            value={postForm.media || []}
            onChange={(media) => setPostForm({ ...postForm, media })}
            help={isShort ? 'Add one or more photos or a short video. The first image is used as the cover.' : 'Optional gallery shown above the journal post.'}
          />
          <TextArea
            label={isShort ? 'Caption' : 'Summary (excerpt)'}
            value={postForm.excerpt}
            onChange={(value) => setPostForm({ ...postForm, excerpt: value })}
            placeholder={isShort ? 'Share a quick note about what you’re working on…' : 'Short preview shown on your Updates feed.'}
          />
          {!isShort && (
            <MediaImageField label="Cover image (optional)" value={postForm.coverImage || ''} onChange={(value) => setPostForm({ ...postForm, coverImage: value })} />
          )}
          {!isShort && (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-gray-700">Article body</span>
              <RichTextEditor value={postForm.content || '<p></p>'} onChange={(content) => setPostForm({ ...postForm, content })} />
            </div>
          )}
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <SelectField
              label="Who can see this"
              value={postForm.visibility === 'private' ? 'private' : 'public'}
              options={['public', 'private']}
              optionLabels={{ public: 'Everyone (public updates)', private: 'Selected collectors only' }}
              onChange={(value) => setPostForm({ ...postForm, visibility: value, audienceEmails: value === 'public' ? [] : postForm.audienceEmails })}
            />
            <CheckboxField label="Feature at the top of Updates" checked={Boolean(postForm.featured)} onChange={(checked) => setPostForm({ ...postForm, featured: checked })} />
          </div>
          {postForm.visibility === 'private' && (
            <>
              <CollectorWhitelist
                collectors={collectors}
                selected={postForm.audienceEmails || []}
                onChange={(audienceEmails) => setPostForm({ ...postForm, audienceEmails })}
              />
              {Array.isArray(selectedPost?.privateViewers) && selectedPost.privateViewers.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900">Collector views</h3>
                  <p className="mt-1 text-xs text-gray-600">Signed-in collectors who opened this private update.</p>
                  <ul className="mt-3 space-y-2">
                    {selectedPost.privateViewers.map((viewer: { email: string; viewCount: number; lastViewedAt: string }) => (
                      <li key={viewer.email} className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
                        <span>{viewer.email}</span>
                        <span className="text-xs text-gray-500">{viewer.viewCount} view{viewer.viewCount === 1 ? '' : 's'} · {new Date(viewer.lastViewedAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <details
            className="rounded-lg border border-gray-200 bg-gray-50/60 p-4"
            open={Boolean(
              (Array.isArray(postForm.tags) && postForm.tags.length > 0)
              || postForm.pullQuote
              || postForm.location
              || postForm.processStage
              || postForm.relatedProductId
              || postForm.relatedArtworkSlug
              || postForm.slug,
            )}
          >
            <summary className="cursor-pointer select-none text-sm font-medium text-gray-800">
              More options <span className="font-normal text-gray-500">(tags, artwork links, scheduling)</span>
            </summary>
            <div className="mt-4 space-y-4">
              <TagInput
                label="Tags"
                value={Array.isArray(postForm.tags) ? postForm.tags : []}
                onChange={(tags) => setPostForm({ ...postForm, tags })}
                suggestions={existingPostTags}
                placeholder="e.g. studio, process, exhibition"
                help="Type a tag and press Enter or comma to add multiple tags."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label="Link to shop item (optional)"
                  value={postForm.relatedProductId || ''}
                  options={['', ...products.map((product: { id: string }) => product.id)]}
                  optionLabels={Object.fromEntries([
                    ['', 'None'],
                    ...products.map((product: { id: string; title?: string }) => [product.id, product.title || product.id]),
                  ])}
                  onChange={(value) => setPostForm({ ...postForm, relatedProductId: value })}
                />
                <SelectField
                  label="Link to portfolio piece (optional)"
                  value={postForm.relatedArtworkSlug || ''}
                  options={['', ...artworks.map((artwork: { slug: string }) => artwork.slug)]}
                  optionLabels={Object.fromEntries([
                    ['', 'None'],
                    ...artworks.map((artwork: { slug: string; title?: string }) => [artwork.slug, artwork.title || artwork.slug]),
                  ])}
                  onChange={(value) => setPostForm({ ...postForm, relatedArtworkSlug: value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="Location (optional)" value={postForm.location || ''} onChange={(value) => setPostForm({ ...postForm, location: value })} />
                <SelectField
                  label="Process stage"
                  value={postForm.processStage || ''}
                  options={['', ...POST_PROCESS_STAGES]}
                  optionLabels={{ '': 'None', sketch: 'Sketch / drawing', glaze: 'Glaze / in progress', finished: 'Finished', other: 'Other' }}
                  onChange={(value) => setPostForm({ ...postForm, processStage: value })}
                />
              </div>
              <TextField label="Pull quote (optional)" value={postForm.pullQuote || ''} onChange={(value) => setPostForm({ ...postForm, pullQuote: value })} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="Publish date" type="date" value={postForm.publishedAt || ''} onChange={(value) => setPostForm({ ...postForm, publishedAt: value })} />
                <TextField label="URL slug (optional)" value={postForm.slug || ''} onChange={(value) => setPostForm({ ...postForm, slug: value })} help="Leave blank to generate automatically." />
              </div>
            </div>
          </details>
          {selectedPost?.slug && postForm.isDraft && (
            <PreviewLink slug={selectedPost.slug} />
          )}
        </EditorShell>
        ) : (
          <EditorPlaceholder
            title="Select or create an update"
            body="Choose an update on the left, or share a new studio note or journal post."
            buttonLabel="New update"
            onNew={startNewPost}
          />
        )}
      </div>
      </div>
    );
  }

  const selectedArtwork = artworks.find((artwork) => artwork.slug === selectedId);
  const showArtworkEditor = Boolean(selectedArtwork) || isCreating;
  return (
    <div className="space-y-4">
      <SectionIntro title={intro.title} body={intro.body} collapsedOnSmall={showArtworkEditor} />
      {!showArtworkEditor && <FormMessage message={message} />}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ContentList
        title="Portfolio"
        items={artworks}
        loadState={loadState}
        onRetry={retryLoad}
        hiddenOnSmall={showArtworkEditor}
        selectedKey={selectedId}
        labelKey="title"
        getThumb={(item) => orderedPhotos(item.images?.thumbnail, [item.images?.main])[0] || ''}
        getMeta={(item) => [item.medium, item.year].filter(Boolean).join(' · ')}
        searchable
        searchPlaceholder="Search title, medium, category…"
        emptyTitle="No portfolio pieces yet"
        emptyHint="Add works collectors can browse and inquire about."
        onNew={() => startNewArtwork()}
        onSelect={(item) => {
          if (item.slug !== selectedId && !confirmDiscardIfDirty()) return;
          revealEditorOnOpen.current = true;
          setSelectedId(item.slug);
          setIsCreating(false);
          setArtworkForm(item);
          setSavedSnapshot(JSON.stringify(item));
          setMessage(null);
        }}
        badge={(item) => (
          <span className="flex flex-wrap gap-1">
            {item.featured && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Featured</span>}
            {item.available
              ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Available</span>
              : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Archive</span>}
          </span>
        )}
      />
      {showArtworkEditor ? (
      <EditorShell
        key={`artwork:${openEditorKey || 'none'}`}
        editorRef={editorRef}
        heading={selectedArtwork ? 'Editing portfolio piece' : 'New portfolio piece'}
        backLabel="All portfolio pieces"
        onBack={closeEditor}
        liveHref={selectedArtwork ? `/portfolio/${encodeURIComponent(selectedArtwork.slug)}` : undefined}
        message={message}
        saving={saving}
        isDirty={isDirty}
        isCreating={isCreating}
        onDuplicate={selectedArtwork ? () => duplicateCurrentArtwork(selectedArtwork.title) : undefined}
        extraActions={selectedArtwork ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (!confirmDiscardIfDirty()) return;
              router.push(`/admin?tab=products&fromArtwork=${encodeURIComponent(selectedArtwork.slug)}`);
            }}
            className="min-h-10 shrink-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            List in shop
          </button>
        ) : undefined}
        onDelete={selectedArtwork ? () => remove(`/api/admin/artworks/${selectedArtwork.slug}`) : undefined}
        onSubmit={() => {
          if (!artworkForm.title.trim()) {
            setMessage({ type: 'error', text: 'Enter a title before saving.' });
            return;
          }
          void save(
            selectedArtwork ? `/api/admin/artworks/${selectedArtwork.slug}` : '/api/admin/artworks',
            selectedArtwork ? 'PUT' : 'POST',
            artworkForm,
          );
        }}
      >
        <div className="space-y-4">
          <TextField label="Title" value={artworkForm.title} onChange={(value) => setArtworkForm({ ...artworkForm, title: value })} placeholder="e.g. Autumn Study No. 4" />
          <GalleryField
            label="Photos"
            firstItemLabel="Main"
            value={orderedPhotos(artworkForm.images?.main, artworkForm.images?.gallery)}
            onChange={(photos) => {
              const main = photos[0] || '';
              const mainChanged = main !== (artworkForm.images?.main || '');
              setArtworkForm({
                ...artworkForm,
                images: {
                  ...artworkForm.images,
                  main,
                  // Grids show the thumbnail, so it must follow the main photo whenever that changes.
                  thumbnail: mainChanged ? main : artworkForm.images?.thumbnail || main,
                  gallery: photos,
                },
              });
            }}
            help="The first photo is the main image. Add detail shots, framed views, or studio angles after it."
          />
          <TextArea
            label="Summary"
            value={artworkForm.description}
            onChange={(value) => setArtworkForm({ ...artworkForm, description: value })}
            placeholder="Short description shown on portfolio details. Blank lines create paragraphs."
          />
        </div>

        <div className="space-y-4 border-t border-gray-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CategorySelectField
              label="Medium"
              value={artworkForm.medium || ''}
              options={existingMediums}
              onChange={(value) => setArtworkForm({ ...artworkForm, medium: value })}
              emptyLabel="Select medium…"
              addOptionLabel="+ Add new medium…"
              customPlaceholder="e.g. Acrylic on canvas"
              customInputAriaLabel="New medium name"
            />
            <TextField label="Dimensions" value={artworkForm.dimensions} onChange={(value) => setArtworkForm({ ...artworkForm, dimensions: value })} placeholder='e.g. 11" × 14"' />
            <TextField label="Year" value={artworkForm.year} onChange={(value) => setArtworkForm({ ...artworkForm, year: value })} placeholder="e.g. 2026" />
          </div>
          <div className="space-y-2">
            {portfolioCategories.length > 0 && (
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-gray-700">Portfolio categories</span>
                <div className="flex flex-wrap gap-1.5">
                  {portfolioCategories.map((cat) => {
                    const current: string[] = Array.isArray(artworkForm.category) ? artworkForm.category : [];
                    const active = current.includes(cat.key);
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          const next = active
                            ? current.filter((item) => item !== cat.key)
                            : [...current, cat.key];
                          setArtworkForm({ ...artworkForm, category: next });
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <TagInput
              label={portfolioCategories.length > 0 ? 'Additional categories (optional)' : 'Categories'}
              value={Array.isArray(artworkForm.category) ? artworkForm.category : []}
              onChange={(category) => setArtworkForm({ ...artworkForm, category })}
              suggestions={existingArtworkCategories}
              placeholder="e.g. paintings, illustration, commissions"
              help={
                portfolioCategories.length > 0
                  ? 'Tap categories above or type extra tags and press Enter.'
                  : 'Type a category and press Enter. These become filter tabs on your Portfolio page.'
              }
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-gray-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Availability &amp; display</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField
              label="Status"
              value={artworkForm.available ? 'available' : 'not_available'}
              options={['available', 'not_available']}
              optionLabels={{
                available: 'Available — collectors can inquire',
                not_available: 'Showcase only — archive or private collection',
              }}
              onChange={(value) => setArtworkForm({ ...artworkForm, available: value === 'available' })}
            />
            {artworkForm.available && (
              <TextField
                label="Price (display only)"
                value={artworkForm.price || ''}
                onChange={(value) => setArtworkForm({ ...artworkForm, price: value })}
                placeholder="e.g. $450 or Upon request"
                help={selectedArtwork
                  ? 'Shown on the portfolio page. Use “List in shop” below for online checkout.'
                  : 'Optional display price. Save first to list in your shop.'}
              />
            )}
          </div>
          <div className="space-y-1">
            <CheckboxField label="Featured on homepage" checked={Boolean(artworkForm.featured)} onChange={(checked) => setArtworkForm({ ...artworkForm, featured: checked })} />
            <p className="text-xs text-gray-500">Show this piece in your homepage Featured Works section.</p>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-gray-100 pt-4">
          <span className="block text-sm font-medium text-gray-700">Story &amp; exhibition notes (optional)</span>
          <RichTextEditor value={artworkForm.content || '<p></p>'} onChange={(content) => setArtworkForm({ ...artworkForm, content })} />
        </div>
      </EditorShell>
      ) : (
        <EditorPlaceholder
          title="Select or create a portfolio piece"
          body="Choose a work on the left, or add something to your public gallery."
          buttonLabel="Add portfolio piece"
          onNew={startNewArtwork}
        />
      )}
    </div>
    </div>
  );
}

function SectionIntro({ title, body, collapsedOnSmall }: { title: string; body: string; collapsedOnSmall: boolean }) {
  return (
    <div className={collapsedOnSmall ? 'hidden lg:block' : ''}>
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-0.5 text-sm text-gray-600">{body}</p>
    </div>
  );
}

function EditorPlaceholder({ title, body, buttonLabel = 'New', onNew }: { title: string; body: string; buttonLabel?: string; onNew: () => void }) {
  // Phones and tablets show the list on its own, which already offers New.
  return (
    <div className="hidden flex-col items-start justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8 lg:col-span-2 lg:flex">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-600">{body}</p>
      <button type="button" onClick={onNew} className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        {buttonLabel}
      </button>
    </div>
  );
}

/**
 * Frame shared by the product, update, and portfolio editors: a way back to the list on small
 * screens, the form fields, and a save bar that stays in view with the current save status.
 */
function EditorShell({
  editorRef,
  heading,
  backLabel,
  onBack,
  liveHref,
  message,
  saving,
  isDirty,
  isCreating = false,
  onDuplicate,
  extraActions,
  primaryActions,
  onDelete,
  onSubmit,
  children,
}: {
  editorRef: React.Ref<HTMLFormElement>;
  heading: string;
  backLabel: string;
  onBack: () => void;
  liveHref?: string;
  message: { type: 'success' | 'error'; text: string } | null;
  saving: boolean;
  isDirty: boolean;
  isCreating?: boolean;
  onDuplicate?: () => void;
  extraActions?: React.ReactNode;
  primaryActions?: React.ReactNode;
  onDelete?: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  const status = message?.type === 'error'
    ? { text: message.text, tone: 'text-red-700', role: 'alert' as const }
    : isDirty
      ? { text: message?.type === 'success' ? message.text : 'Unsaved changes', tone: 'text-gray-600', role: 'status' as const }
      : message
        ? { text: message.text, tone: 'text-green-700', role: 'status' as const }
        : { text: onDelete ? 'All changes saved' : 'Not saved yet', tone: 'text-gray-600', role: 'status' as const };

  return (
    <form
      ref={editorRef}
      className="scroll-mt-24 space-y-4 rounded-lg border bg-white p-4 sm:p-6 lg:col-span-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-gray-700 hover:bg-gray-100 lg:hidden"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {backLabel}
        </button>
        <span className="hidden text-xs font-medium text-gray-500 lg:inline">{heading}</span>
        {liveHref && (
          <a href={liveHref} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline lg:text-xs">
            View live ↗
          </a>
        )}
      </div>
      {children}
      <div className="sticky bottom-above-admin-nav -mx-4 -mb-4 flex flex-wrap items-center justify-end gap-x-2.5 gap-y-2 rounded-b-lg border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 md:bottom-0">
        <p className={`mr-auto min-w-0 basis-32 grow text-xs ${status.tone}`} role={status.role}>{status.text}</p>
        {extraActions}
        {onDuplicate && (
          <button
            type="button"
            onClick={onDuplicate}
            disabled={saving}
            className="min-h-10 shrink-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Duplicate
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} disabled={saving} className="min-h-10 shrink-0 rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
            Delete
          </button>
        )}
        {primaryActions ?? (
          <button type="submit" disabled={saving || (!isDirty && !isCreating)} className="btn-primary min-h-10 shrink-0 px-5 text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </form>
  );
}

function ContentList({ title, items, loadState, onRetry, hiddenOnSmall, labelKey, selectedKey, onNew, onSelect, badge, emptyTitle, emptyHint, getLabel, getThumb, getMeta, searchable, searchPlaceholder }: {
  title: string;
  items: any[];
  loadState: 'loading' | 'ready' | 'error';
  onRetry: () => void;
  /** On phones and tablets the open editor takes the list's place. */
  hiddenOnSmall: boolean;
  labelKey: string;
  selectedKey?: string | null;
  onNew: () => void;
  onSelect: (item: any) => void;
  badge?: (item: any) => React.ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  getLabel?: (item: any) => string;
  getThumb?: (item: any) => string;
  getMeta?: (item: any) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = React.useState('');
  const filteredItems = !searchable || !query.trim()
    ? items
    : items.filter((item) => {
        const needle = query.trim().toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags.join(' ') : '';
        const categories = Array.isArray(item.category) ? item.category.join(' ') : item.category;
        const haystack = [
          getLabel ? getLabel(item) : item[labelKey],
          item.slug,
          item.id,
          item.excerpt,
          categories,
          item.medium,
          tags,
          item.availability,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(needle);
      });

  return (
    <div className={`space-y-3 rounded-lg border bg-white p-4 lg:sticky lg:top-24 lg:self-start ${hiddenOnSmall ? 'hidden lg:block' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          All {title.toLowerCase()}
          {loadState === 'ready' && <span className="ml-1.5 font-normal text-gray-500">({items.length})</span>}
        </h3>
        <button type="button" onClick={onNew} className="inline-flex min-h-9 items-center rounded bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">New</button>
      </div>
      {searchable && items.length > 0 && (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder || 'Search…'}
          aria-label={`Search ${title.toLowerCase()}`}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      )}
      <div className="space-y-2 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto">
        {items.length === 0 && loadState === 'loading' ? (
          <div className="space-y-2" role="status" aria-label={`Loading ${title.toLowerCase()}`}>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3 rounded border border-gray-200 p-3">
                <span className="h-10 w-10 shrink-0 animate-pulse rounded bg-gray-100" />
                <span className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : items.length === 0 && loadState === 'error' ? (
          <div className="rounded border border-dashed border-red-200 px-3 py-6 text-center" role="alert">
            <p className="text-sm font-medium text-gray-900">Couldn’t load {title.toLowerCase()}</p>
            <p className="mt-1 text-xs text-gray-500">Check your connection and try again.</p>
            <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-9 items-center text-sm font-medium text-blue-700 hover:text-blue-800">
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded border border-dashed border-gray-200 px-3 py-6 text-center">
            <p className="text-sm font-medium text-gray-900">{emptyTitle || `No ${title.toLowerCase()} yet`}</p>
            {emptyHint && <p className="mt-1 text-xs text-gray-500">{emptyHint}</p>}
            <button type="button" onClick={onNew} className="mt-3 inline-flex min-h-9 items-center text-sm font-medium text-blue-700 hover:text-blue-800 lg:hidden">
              Create one
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="rounded border border-dashed border-gray-200 px-3 py-5 text-center text-sm text-gray-500">
            No matches for “{query.trim()}”.
          </p>
        ) : (
          filteredItems.map((item) => {
            const itemKey = item.id || item.slug;
            const isSelected = selectedKey != null && itemKey === selectedKey;
            const thumb = getThumb?.(item)?.trim() || '';
            const meta = getMeta?.(item) || '';
            return (
              <button
                key={itemKey}
                type="button"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => onSelect(item)}
                className={`block w-full rounded border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MediaThumb src={thumb} sizes="40px" className="h-10 w-10 shrink-0 rounded border border-gray-200" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-900">{getLabel ? getLabel(item) : item[labelKey]}</div>
                    {meta && <div className="truncate text-xs text-gray-500">{meta}</div>}
                    {badge && <div className="mt-1 empty:hidden">{badge(item)}</div>}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function FormMessage({ message }: { message: { type: 'success' | 'error'; text: string } | null }) {
  if (!message) return null;
  const styles =
    message.type === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-green-200 bg-green-50 text-green-800';
  return (
    <div role={message.type === 'error' ? 'alert' : 'status'} className={`rounded border p-3 text-sm ${styles}`}>
      {message.text}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  help,
  placeholder,
}: {
  label: string;
  value: any;
  onChange: (value: string) => void;
  type?: string;
  help?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
      />
      {help ? <span className="mt-1 block text-xs font-normal text-gray-500">{help}</span> : null}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange, optionLabels, id }: { label: string; value: string; options: string[]; onChange: (value: string) => void; optionLabels?: Record<string, string>; id?: string }) {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  return (
    <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
      {label}
      <select id={fieldId} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal">
        {options.map((option) => <option key={option} value={option}>{optionLabels?.[option] || option}</option>)}
      </select>
    </label>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />{label}</label>;
}

function PreviewLink({ slug }: { slug: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/posts/${encodeURIComponent(slug)}/preview`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Preview unavailable');
        if (!cancelled) setUrl(data.url || null);
      })
      .catch((previewError) => {
        if (!cancelled) setError(previewError instanceof Error ? previewError.message : 'Preview unavailable');
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (error) return <p className="text-xs text-amber-700">{error}</p>;
  if (!url) return <p className="text-xs text-gray-500">Loading preview link...</p>;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
      <p className="font-medium text-gray-900">Draft preview</p>
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-primary hover:opacity-80">
        Open draft preview in new tab
      </a>
    </div>
  );
}

function CollectorWhitelist({
  collectors,
  selected,
  onChange,
}: {
  collectors: Array<{ id: string; email: string; name: string; orderCount: number }>;
  selected: string[];
  onChange: (emails: string[]) => void;
}) {
  const [draftEmail, setDraftEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const selectedSet = new Set(selected.map((email) => email.trim().toLowerCase()));
  const extra = selected.filter((email) => !collectors.some((collector) => collector.email === email.trim().toLowerCase()));

  function toggle(email: string, checked: boolean) {
    const normalized = email.trim().toLowerCase();
    if (checked) {
      onChange(selectedSet.has(normalized) ? selected : [...selected, normalized]);
      return;
    }
    onChange(selected.filter((value) => value.trim().toLowerCase() !== normalized));
  }

  function addDraftEmail() {
    const email = draftEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    toggle(email, true);
    setDraftEmail('');
    setEmailError(null);
  }

  return (
    <div className="rounded-md border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-900">Collector whitelist</p>
      <p className="mt-1 text-xs text-gray-500">Only these signed-in emails can see this update. Guest checkout emails work once they create an account with the same address.</p>
      {collectors.length === 0 && extra.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No collector accounts yet. They appear here after someone buys or creates an account.</p>
      ) : (
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {collectors.map((collector) => (
            <label key={collector.email} className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedSet.has(collector.email)}
                onChange={(event) => toggle(collector.email, event.target.checked)}
              />
              <span>
                <span className="font-medium">{collector.name}</span>
                <span className="block text-xs text-gray-500">{collector.email}{collector.orderCount > 0 ? ` · ${collector.orderCount} order${collector.orderCount === 1 ? '' : 's'}` : ''}</span>
              </span>
            </label>
          ))}
          {extra.map((email) => (
            <label key={email} className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-1" checked onChange={(event) => toggle(email, event.target.checked)} />
              <span>{email}</span>
            </label>
          ))}
        </div>
      )}
      <div className="mt-3">
        <label className="block text-xs font-medium text-gray-700">
          Add email
          <div className="mt-1 flex gap-2">
            <input
              type="email"
              value={draftEmail}
              onChange={(event) => {
                setDraftEmail(event.target.value);
                if (emailError) setEmailError(null);
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="collector@email.com"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                addDraftEmail();
              }}
            />
            <button
              type="button"
              onClick={addDraftEmail}
              disabled={!draftEmail.trim()}
              className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </label>
        {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
      </div>
    </div>
  );
}

export default AdminContentManager;