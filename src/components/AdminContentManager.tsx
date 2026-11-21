'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RichTextEditor from '@/components/RichTextEditor';
import { ChevronLeft } from 'lucide-react';
import GalleryField from '@/components/admin/GalleryField';
import MediaImageField from '@/components/admin/MediaImageField';
import MediaThumb from '@/components/admin/MediaThumb';
import ProductPurchaseOptionsFields from '@/components/admin/ProductPurchaseOptionsFields';
import { useUnsavedChangesGuard } from '@/components/admin/useUnsavedChangesGuard';
import type { PostMediaItem } from '@/lib/admin-content';
import { POST_PROCESS_STAGES } from '@/lib/admin-content';
import { formatPrice, PRODUCT_IMAGE_FALLBACK } from '@/lib/commerce';
import type { PortfolioCategory } from '@/lib/site-content-shared';

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
  title: '', description: '', price: 0, currency: 'USD', category: 'paintings', medium: 'Mixed Media', dimensions: '', year: new Date().getFullYear(),
  availability: 'available', featured: false, images: { thumbnail: '', gallery: [] as string[] }, tags: [] as string[],
  shipping: { domestic: 0, international: 0 }, specifications: { framed: false, signed: true, certificate: true },
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
  title: '', description: '', medium: 'Mixed Media', dimensions: '', year: String(new Date().getFullYear()), category: [] as string[], featured: false, available: true, price: '', images: { main: '', thumbnail: '', gallery: [] as string[] }, content: '<p></p>',
};

function csv(value: string[] | undefined): string {
  return (value || []).join(', ');
}

function list(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseNumberField(value: string): number | '' {
  if (!value.trim()) return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : '';
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
 * The photos an item shows publicly, in order: the cover first, then the rest of the gallery.
 * The stock placeholder the server stores for photo-less items is not one of the artist's photos.
 */
function orderedPhotos(cover: string | undefined, gallery: string[] | undefined): string[] {
  return [cover, ...(Array.isArray(gallery) ? gallery : [])]
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter((url, index, all) => Boolean(url) && url !== PRODUCT_IMAGE_FALLBACK && all.indexOf(url) === index);
}

function formatListDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function AdminContentManager({ section }: AdminContentManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createIntentConsumed = useRef(false);
  const [products, setProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [artworks, setArtworks] = useState<any[]>([]);
  const [productForm, setProductForm] = useState<any>(blankProduct);
  const [postForm, setPostForm] = useState<any>(blankPost);
  const [artworkForm, setArtworkForm] = useState<any>(blankArtwork);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inventoryByProduct, setInventoryByProduct] = useState<Record<string, { currentStock: number; stockStatus: string }>>({});
  const [productStock, setProductStock] = useState<number | ''>(1);
  const [collectors, setCollectors] = useState<Array<{ id: string; email: string; name: string; orderCount: number }>>([]);
  const [artistName, setArtistName] = useState<string>('Artist');
  const [portfolioCategories, setPortfolioCategories] = useState<PortfolioCategory[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const editorRef = useRef<HTMLFormElement>(null);
  const revealEditorOnOpen = useRef(false);

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

  useEffect(() => {
    void loadAll();
  }, []);

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

  useEffect(() => {
    createIntentConsumed.current = false;
    setIsCreating(false);
    setSelectedId(null);
    setSavedSnapshot('');
    setMessage(null);
  }, [section]);

  useEffect(() => {
    if (searchParams.get('create') !== '1' || createIntentConsumed.current) return;
    createIntentConsumed.current = true;
    if (section === 'products') startNewProduct(true);
    else if (section === 'posts') startNewPost(true);
    else startNewArtwork(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    const query = params.toString();
    router.replace(query ? `/admin?${query}` : '/admin', { scroll: false });
  }, [searchParams, section, router]);

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

  async function loadAll() {
    try {
      const [productResponse, postResponse, artworkResponse, siteContentResponse] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/admin/posts'),
        fetch('/api/admin/artworks'),
        fetch('/api/admin/site-content', { cache: 'no-store' }).catch(() => null),
      ]);
      if (!productResponse.ok || !postResponse.ok || !artworkResponse.ok) {
        throw new Error('Content request failed');
      }
      const [productData, postData, artworkData, siteContentData] = await Promise.all([
        productResponse.json(),
        postResponse.json(),
        artworkResponse.json(),
        siteContentResponse && siteContentResponse.ok ? siteContentResponse.json().catch(() => null) : Promise.resolve(null),
      ]);
      if (siteContentData?.identity?.siteName) {
        setArtistName(siteContentData.identity.siteName);
      }
      if (Array.isArray(siteContentData?.portfolio?.categories)) {
        setPortfolioCategories(siteContentData.portfolio.categories);
      }
      const loadedProducts = productData.products || [];
      setProducts(loadedProducts);
      setPosts(Array.isArray(postData) ? postData : postData.posts || []);
      setCollectors(Array.isArray(postData?.collectors) ? postData.collectors : []);
      setArtworks(artworkData.artworks || []);
      setLoadState('ready');
      await loadInventory(loadedProducts.map((product: { id: string }) => product.id));
    } catch {
      // Keep whatever is already listed (e.g. after a save); only an empty first load shows the retry state.
      setLoadState((current) => (current === 'ready' ? current : 'error'));
    }
  }

  function retryLoad() {
    setLoadState('loading');
    void loadAll();
  }

  async function saveStock(productId: string, stock: number) {
    await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bulk_update',
        updates: [{ productId, currentStock: stock }],
      }),
    });
  }

  async function save(endpoint: string, method: 'POST' | 'PUT', body: unknown, options?: { productId?: string; stock?: number }) {
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
      if (savedProductId && typeof options?.stock === 'number') {
        await saveStock(savedProductId, options.stock);
      }
      const savedId =
        data.product?.id
        || data.artwork?.slug
        || data.post?.slug
        || options?.productId
        || selectedId;
      await loadAll();
      let nextSnapshot = currentSnapshot;
      if (section === 'products' && data.product) {
        const nextStock = typeof options?.stock === 'number' ? options.stock : productStock;
        setProductForm(data.product);
        setProductStock(nextStock);
        nextSnapshot = JSON.stringify({ form: data.product, stock: nextStock });
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
      setMessage({ type: 'success', text: 'Saved' });
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
      await loadAll();
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
          getThumb={(item) => orderedPhotos(item.images?.thumbnail, item.images?.gallery)[0] || ''}
          getMeta={(item) => [formatPrice(coerceNumber(item.price, 0), item.currency || 'USD'), item.category].filter(Boolean).join(' · ')}
          searchable
          searchPlaceholder="Search title, category, tags…"
          emptyTitle="No products yet"
          emptyHint="Add your first shop listing so collectors can check out."
          onNew={() => startNewProduct()}
          onSelect={(item) => {
            if (item.id !== selectedId && !confirmDiscardIfDirty()) return;
            const nextStock = inventoryByProduct[item.id]?.currentStock ?? 1;
            revealEditorOnOpen.current = true;
            setSelectedId(item.id);
            setIsCreating(false);
            setProductForm(item);
            setProductStock(nextStock);
            setSavedSnapshot(JSON.stringify({ form: item, stock: nextStock }));
            setMessage(null);
          }}
          badge={(item) => {
            const status = inventoryByProduct[item.id]?.stockStatus;
            if (item.availability === 'sold') return <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Sold</span>;
            if (item.availability === 'commissioned') return <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">Commission</span>;
            if (status === 'low_stock') return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Low stock</span>;
            if (status === 'out_of_stock') return <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Out of stock</span>;
            return null;
          }}
        />
        {showEditor ? (
        <EditorShell
          editorRef={editorRef}
          heading={selectedProduct ? 'Editing product' : 'New product'}
          backLabel="All products"
          onBack={closeEditor}
          liveHref={selectedProduct ? `/shop/${encodeURIComponent(selectedProduct.id)}` : undefined}
          message={message}
          saving={saving}
          isDirty={isDirty}
          onDelete={selectedProduct ? () => remove(`/api/admin/products/${selectedProduct.id}`) : undefined}
          onSubmit={() => {
          const stockCount = Math.max(0, Math.floor(coerceNumber(productStock, 0)));
          const normalizedPayload = {
            ...productForm,
            price: coerceNumber(productForm.price, 0),
            year: Math.floor(coerceNumber(productForm.year, new Date().getFullYear())),
            shipping: {
              ...productForm.shipping,
              domestic: coerceNumber(productForm.shipping?.domestic, 0),
              international: coerceNumber(productForm.shipping?.international, 0),
            },
            edition: productForm.edition?.total
              ? {
                  total: productForm.edition.total,
                  remaining: Math.min(productForm.edition.total, stockCount),
                }
              : null,
          };
          save(
            selectedProduct ? `/api/admin/products/${selectedProduct.id}` : '/api/admin/products',
            selectedProduct ? 'PUT' : 'POST',
            normalizedPayload,
            { productId: selectedProduct?.id, stock: stockCount },
          );
        }}>
          <TextField label="Title" value={productForm.title} onChange={(value) => setProductForm({ ...productForm, title: value })} />
          <TextArea label="Description" value={productForm.description} onChange={(value) => setProductForm({ ...productForm, description: value })} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextField label="Price" type="number" value={productForm.price} onChange={(value) => setProductForm({ ...productForm, price: parseNumberField(value) })} />
            <TextField label="Category" value={productForm.category} onChange={(value) => setProductForm({ ...productForm, category: value })} />
            <TextField label="Medium" value={productForm.medium} onChange={(value) => setProductForm({ ...productForm, medium: value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextField label="Dimensions" value={productForm.dimensions} onChange={(value) => setProductForm({ ...productForm, dimensions: value })} />
            <TextField label="Year" type="number" value={productForm.year} onChange={(value) => setProductForm({ ...productForm, year: parseNumberField(value) })} />
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
          <GalleryField
            label="Photos"
            firstItemLabel="Cover"
            value={orderedPhotos(productForm.images?.thumbnail, productForm.images?.gallery)}
            onChange={(photos) => setProductForm({
              ...productForm,
              images: { ...productForm.images, thumbnail: photos[0] || '', gallery: photos },
            })}
            help="The first photo is the cover shown in the shop. Use the arrows to change the order."
          />
          <TextField label="Tags (comma-separated)" value={csv(productForm.tags)} onChange={(value) => setProductForm({ ...productForm, tags: list(value) })} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Domestic Shipping" type="number" value={productForm.shipping?.domestic ?? ''} onChange={(value) => setProductForm({ ...productForm, shipping: { ...productForm.shipping, domestic: parseNumberField(value) } })} />
            <TextField label="International Shipping" type="number" value={productForm.shipping?.international ?? ''} onChange={(value) => setProductForm({ ...productForm, shipping: { ...productForm.shipping, international: parseNumberField(value) } })} />
          </div>
          <TextField
            label="How many do you have?"
            type="number"
            value={productStock}
            onChange={(value) => {
              const parsed = parseNumberField(value);
              const numericStock = parsed === '' ? 0 : Math.max(0, Math.floor(parsed));
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
          />
          <TextField
            label="Edition size (optional)"
            type="number"
            value={productForm.edition?.total ?? ''}
            onChange={(value) => {
              const total = Number(value);
              if (!value.trim() || !Number.isFinite(total) || total < 1) {
                setProductForm({ ...productForm, edition: null });
                return;
              }
              const stockCount = Math.max(0, Math.floor(coerceNumber(productStock, 0)));
              setProductForm({
                ...productForm,
                edition: {
                  total: Math.floor(total),
                  remaining: Math.min(Math.floor(total), stockCount),
                },
              });
            }}
          />
          <p className="text-xs text-gray-500 -mt-2">For limited prints, set the edition size. Remaining copies follow “How many do you have?”</p>
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
        </EditorShell>
        ) : (
          <EditorPlaceholder
            title="Select or create a product"
            body="Choose a listing on the left, or tap New to add something collectors can buy."
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
    const showEditor = Boolean(selectedPost) || isCreating;
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
          emptyHint="Publish a studio note or journal post for your Updates feed."
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
          editorRef={editorRef}
          heading={!selectedPost ? 'New update' : selectedPost.isDraft ? 'Editing draft' : 'Editing published update'}
          backLabel="All updates"
          onBack={closeEditor}
          liveHref={selectedPost && !selectedPost.isDraft && selectedPost.visibility !== 'private' ? `/updates/${encodeURIComponent(selectedPost.slug)}` : undefined}
          message={message}
          saving={saving}
          isDirty={isDirty}
          onDelete={selectedPost ? () => remove(`/api/admin/posts/${selectedPost.slug}`) : undefined}
          onSubmit={() => save(selectedPost ? `/api/admin/posts/${selectedPost.slug}` : '/api/admin/posts', selectedPost ? 'PUT' : 'POST', postForm)}
        >
          <SelectField
            label="Update type"
            value={isShort ? 'short' : 'article'}
            options={['short', 'article']}
            optionLabels={{ short: 'Studio post (photo, video, caption)', article: 'Journal post (longer writing)' }}
            onChange={(value) => setPostForm({ ...postForm, format: value })}
          />
          {!isShort && (
            <TextField label="Title" value={postForm.title} onChange={(value) => setPostForm({ ...postForm, title: value })} />
          )}
          <TextArea
            label={isShort ? 'Caption' : 'Excerpt'}
            value={postForm.excerpt}
            onChange={(value) => setPostForm({ ...postForm, excerpt: value })}
          />
          <GalleryField
            accept="media"
            label={isShort ? 'Photos and video' : 'Photos and video (optional)'}
            value={postForm.media || []}
            onChange={(media) => setPostForm({ ...postForm, media })}
            help={isShort ? 'Add one or more photos or a short video. First image is used as the cover.' : 'Optional gallery shown above the journal post.'}
          />
          {!isShort && (
            <MediaImageField label="Cover image" value={postForm.coverImage || ''} onChange={(value) => setPostForm({ ...postForm, coverImage: value })} />
          )}
          <TextField label="Tags (comma-separated)" value={csv(postForm.tags)} onChange={(value) => setPostForm({ ...postForm, tags: list(value) })} />
          <TextField label="Pull quote (optional)" value={postForm.pullQuote || ''} onChange={(value) => setPostForm({ ...postForm, pullQuote: value })} />
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
          <TextField label="URL slug (optional)" value={postForm.slug || ''} onChange={(value) => setPostForm({ ...postForm, slug: value })} />
          <TextField label="Publish date" type="date" value={postForm.publishedAt || ''} onChange={(value) => setPostForm({ ...postForm, publishedAt: value })} />
          <div className="flex flex-wrap gap-4">
            <CheckboxField label="Published" checked={!postForm.isDraft} onChange={(checked) => setPostForm({ ...postForm, isDraft: !checked })} />
            <CheckboxField label="Featured" checked={Boolean(postForm.featured)} onChange={(checked) => setPostForm({ ...postForm, featured: checked })} />
          </div>
          <SelectField
            label="Who can see this"
            value={postForm.visibility === 'private' ? 'private' : 'public'}
            options={['public', 'private']}
            optionLabels={{ public: 'Everyone (public updates)', private: 'Selected collectors only' }}
            onChange={(value) => setPostForm({ ...postForm, visibility: value, audienceEmails: value === 'public' ? [] : postForm.audienceEmails })}
          />
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
          {!isShort && (
            <RichTextEditor value={postForm.content || '<p></p>'} onChange={(content) => setPostForm({ ...postForm, content })} />
          )}
          {selectedPost?.slug && postForm.isDraft && (
            <PreviewLink slug={selectedPost.slug} />
          )}
        </EditorShell>
        ) : (
          <EditorPlaceholder
            title="Select or create an update"
            body="Choose a draft on the left, or tap New to share a studio note or journal post."
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
              : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Sold</span>}
          </span>
        )}
      />
      {showArtworkEditor ? (
      <EditorShell
        editorRef={editorRef}
        heading={selectedArtwork ? 'Editing portfolio piece' : 'New portfolio piece'}
        backLabel="All portfolio pieces"
        onBack={closeEditor}
        liveHref={selectedArtwork ? `/portfolio/${encodeURIComponent(selectedArtwork.slug)}` : undefined}
        message={message}
        saving={saving}
        isDirty={isDirty}
        onDelete={selectedArtwork ? () => remove(`/api/admin/artworks/${selectedArtwork.slug}`) : undefined}
        onSubmit={() => save(selectedArtwork ? `/api/admin/artworks/${selectedArtwork.slug}` : '/api/admin/artworks', selectedArtwork ? 'PUT' : 'POST', artworkForm)}
      >
        <TextField label="Title" value={artworkForm.title} onChange={(value) => setArtworkForm({ ...artworkForm, title: value })} />
        <TextArea label="Description" value={artworkForm.description} onChange={(value) => setArtworkForm({ ...artworkForm, description: value })} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TextField label="Medium" value={artworkForm.medium} onChange={(value) => setArtworkForm({ ...artworkForm, medium: value })} />
          <TextField label="Dimensions" value={artworkForm.dimensions} onChange={(value) => setArtworkForm({ ...artworkForm, dimensions: value })} />
          <TextField label="Year" value={artworkForm.year} onChange={(value) => setArtworkForm({ ...artworkForm, year: value })} />
        </div>
        <TextField label="Price (display only)" value={artworkForm.price || ''} onChange={(value) => setArtworkForm({ ...artworkForm, price: value })} />
        <p className="text-xs text-gray-500 -mt-2">Shown on the portfolio page. Online checkout still needs a matching product under Products.</p>
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
        <div className="space-y-2">
          <TextField
            label="Categories (comma-separated)"
            value={csv(artworkForm.category)}
            onChange={(value) => setArtworkForm({ ...artworkForm, category: list(value) })}
            help="Match keys from Pages → Portfolio → Categories (for example: paintings, works-on-paper)."
          />
          {portfolioCategories.length > 0 && (
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
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
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
          )}
        </div>
        <SelectField
          label="Status"
          value={artworkForm.available ? 'available' : 'sold'}
          options={['available', 'sold']}
          optionLabels={{ available: 'Available — collectors can inquire', sold: 'Sold — shown with a Sold badge' }}
          onChange={(value) => setArtworkForm({ ...artworkForm, available: value === 'available' })}
        />
        <CheckboxField label="Featured" checked={Boolean(artworkForm.featured)} onChange={(checked) => setArtworkForm({ ...artworkForm, featured: checked })} />
        <RichTextEditor value={artworkForm.content || '<p></p>'} onChange={(content) => setArtworkForm({ ...artworkForm, content })} />
      </EditorShell>
      ) : (
        <EditorPlaceholder
          title="Select or create a portfolio piece"
          body="Choose a work on the left, or tap New to add something to your public gallery."
          onNew={startNewArtwork}
        />
      )}
    </div>
    </div>
  );
}

function SectionIntro({ title, body, collapsedOnSmall }: { title: string; body: string; collapsedOnSmall: boolean }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white px-4 py-3 ${collapsedOnSmall ? 'hidden lg:block' : ''}`}>
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
    </div>
  );
}

function EditorPlaceholder({ title, body, onNew }: { title: string; body: string; onNew: () => void }) {
  // Phones and tablets show the list on its own, which already offers New.
  return (
    <div className="hidden flex-col items-start justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8 lg:col-span-2 lg:flex">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-600">{body}</p>
      <button type="button" onClick={onNew} className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        New
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
  onDelete?: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  const status = message?.type === 'error'
    ? { text: message.text, tone: 'text-red-700', role: 'alert' as const }
    : isDirty
      ? { text: 'Unsaved changes', tone: 'text-gray-600', role: 'status' as const }
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
        <span className="hidden text-xs text-gray-500 lg:inline">{heading}</span>
        {liveHref && (
          <a href={liveHref} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline lg:text-xs">
            View live ↗
          </a>
        )}
      </div>
      {children}
      <div className="sticky bottom-above-admin-nav -mx-4 -mb-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 rounded-b-lg border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 md:bottom-0">
        <p className={`mr-auto min-w-0 basis-32 grow text-xs ${status.tone}`} role={status.role}>{status.text}</p>
        {onDelete && (
          <button type="button" onClick={onDelete} disabled={saving} className="min-h-10 shrink-0 rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
            Delete
          </button>
        )}
        <button type="submit" disabled={saving || !isDirty} className="btn-primary min-h-10 shrink-0 px-5 text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
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
    <div className={`space-y-3 rounded-lg border bg-white p-4 ${hiddenOnSmall ? 'hidden lg:block' : ''}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{title}</h2>
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
      <div className="space-y-2 lg:max-h-[36rem] lg:overflow-y-auto">
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
            <button type="button" onClick={onNew} className="mt-3 inline-flex min-h-9 items-center text-sm font-medium text-blue-700 hover:text-blue-800">
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

function TextField({ label, value, onChange, type = 'text', help }: { label: string; value: any; onChange: (value: string) => void; type?: string; help?: string }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
      {help ? <span className="mt-1 block text-xs font-normal text-gray-500">{help}</span> : null}
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-gray-700">{label}<textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" /></label>;
}

function SelectField({ label, value, options, onChange, optionLabels, id }: { label: string; value: string; options: string[]; onChange: (value: string) => void; optionLabels?: Record<string, string>; id?: string }) {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  return (
    <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
      {label}
      <select id={fieldId} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
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