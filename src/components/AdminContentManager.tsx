'use client';

import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RichTextEditor from '@/components/RichTextEditor';
import GalleryField from '@/components/admin/GalleryField';
import MediaImageField from '@/components/admin/MediaImageField';
import ProductPurchaseOptionsFields from '@/components/admin/ProductPurchaseOptionsFields';
import type { PostMediaItem } from '@/lib/admin-content';
import { POST_PROCESS_STAGES } from '@/lib/admin-content';

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
  title: '', description: '', medium: 'Mixed Media', dimensions: '', year: String(new Date().getFullYear()), category: [] as string[], featured: false, available: false, price: '', images: { main: '', thumbnail: '', gallery: [] as string[] }, content: '<p></p>',
};

function csv(value: string[] | undefined): string {
  return (value || []).join(', ');
}

function list(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
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
  const [productStock, setProductStock] = useState<number>(1);
  const [collectors, setCollectors] = useState<Array<{ id: string; email: string; name: string; orderCount: number }>>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  function startNewProduct() {
    setSelectedId(null);
    setIsCreating(true);
    setProductForm(blankProduct);
    setProductStock(1);
    setMessage(null);
  }

  function startNewPost() {
    setSelectedId(null);
    setIsCreating(true);
    setPostForm(blankPost);
    setMessage(null);
  }

  function startNewArtwork() {
    setSelectedId(null);
    setIsCreating(true);
    setArtworkForm(blankArtwork);
    setMessage(null);
  }

  useEffect(() => {
    createIntentConsumed.current = false;
    setIsCreating(false);
    setSelectedId(null);
    setMessage(null);
  }, [section]);

  useEffect(() => {
    if (searchParams.get('create') !== '1' || createIntentConsumed.current) return;
    createIntentConsumed.current = true;
    if (section === 'products') startNewProduct();
    else if (section === 'posts') startNewPost();
    else startNewArtwork();

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
    const [productResponse, postResponse, artworkResponse] = await Promise.all([
      fetch('/api/admin/products'),
      fetch('/api/admin/posts'),
      fetch('/api/admin/artworks'),
    ]);
    const [productData, postData, artworkData] = await Promise.all([
      productResponse.json(), postResponse.json(), artworkResponse.json()
    ]);
    const loadedProducts = productData.products || [];
    setProducts(loadedProducts);
    setPosts(Array.isArray(postData) ? postData : postData.posts || []);
    setCollectors(Array.isArray(postData?.collectors) ? postData.collectors : []);
    setArtworks(artworkData.artworks || []);
    await loadInventory(loadedProducts.map((product: { id: string }) => product.id));
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Save failed');
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
      setSelectedId(savedId || null);
      setIsCreating(false);
      setMessage({ type: 'success', text: 'Saved successfully.' });
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
      setMessage({ type: 'success', text: 'Deleted successfully.' });
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
        <SectionIntro title={intro.title} body={intro.body} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContentList
          title="Products"
          items={products}
          selectedKey={selectedId}
          labelKey="title"
          searchable
          searchPlaceholder="Search title, category, tags…"
          emptyTitle="No products yet"
          emptyHint="Add your first shop listing so collectors can check out."
          onNew={startNewProduct}
          onSelect={(item) => {
            setSelectedId(item.id);
            setIsCreating(false);
            setProductForm(item);
            setProductStock(inventoryByProduct[item.id]?.currentStock ?? 1);
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
        <form className="lg:col-span-2 bg-white rounded-lg border p-6 space-y-4" onSubmit={(event) => {
          event.preventDefault();
          save(
            selectedProduct ? `/api/admin/products/${selectedProduct.id}` : '/api/admin/products',
            selectedProduct ? 'PUT' : 'POST',
            productForm,
            { productId: selectedProduct?.id, stock: productStock },
          );
        }}>
          <FormMessage message={message} />
          {selectedProduct?.id && (
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <span className="text-xs text-gray-500">Editing product</span>
              <a
                href={`/shop/${encodeURIComponent(selectedProduct.id)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-primary hover:underline"
              >
                View live ↗
              </a>
            </div>
          )}
          <TextField label="Title" value={productForm.title} onChange={(value) => setProductForm({ ...productForm, title: value })} />
          <TextArea label="Description" value={productForm.description} onChange={(value) => setProductForm({ ...productForm, description: value })} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextField label="Price" type="number" value={productForm.price} onChange={(value) => setProductForm({ ...productForm, price: Number(value) })} />
            <TextField label="Category" value={productForm.category} onChange={(value) => setProductForm({ ...productForm, category: value })} />
            <TextField label="Medium" value={productForm.medium} onChange={(value) => setProductForm({ ...productForm, medium: value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextField label="Dimensions" value={productForm.dimensions} onChange={(value) => setProductForm({ ...productForm, dimensions: value })} />
            <TextField label="Year" type="number" value={productForm.year} onChange={(value) => setProductForm({ ...productForm, year: Number(value) })} />
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
          <MediaImageField
            label="Thumbnail"
            value={productForm.images?.thumbnail || ''}
            onChange={(value) => setProductForm({
              ...productForm,
              images: {
                ...productForm.images,
                thumbnail: value,
                gallery: productForm.images.gallery?.length ? productForm.images.gallery : value ? [value] : [],
              },
            })}
          />
          <GalleryField
            label="Photo gallery"
            value={productForm.images?.gallery || []}
            onChange={(gallery) => setProductForm({ ...productForm, images: { ...productForm.images, gallery } })}
            help="Add multiple photos for the product detail page."
          />
          <TextField label="Tags (comma-separated)" value={csv(productForm.tags)} onChange={(value) => setProductForm({ ...productForm, tags: list(value) })} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Domestic Shipping" type="number" value={productForm.shipping?.domestic || 0} onChange={(value) => setProductForm({ ...productForm, shipping: { ...productForm.shipping, domestic: Number(value) } })} />
            <TextField label="International Shipping" type="number" value={productForm.shipping?.international || 0} onChange={(value) => setProductForm({ ...productForm, shipping: { ...productForm.shipping, international: Number(value) } })} />
          </div>
          <TextField label="How many do you have?" type="number" value={productStock} onChange={(value) => setProductStock(Number(value) || 0)} />
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
              setProductForm({
                ...productForm,
                edition: {
                  total: Math.floor(total),
                  remaining: Math.min(Math.floor(total), Math.max(0, productStock)),
                },
              });
            }}
          />
          <p className="text-xs text-gray-500 -mt-2">For limited prints, set the edition size. Remaining copies follow “How many do you have?”</p>
          <CheckboxField label="Featured" checked={Boolean(productForm.featured)} onChange={(checked) => setProductForm({ ...productForm, featured: checked })} />
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
          <ActionRow saving={saving} onDelete={selectedProduct ? () => remove(`/api/admin/products/${selectedProduct.id}`) : undefined} />
        </form>
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
        <SectionIntro title={intro.title} body={intro.body} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContentList
          title="Updates"
          items={posts}
          selectedKey={selectedId}
          labelKey="title"
          emptyTitle="No updates yet"
          emptyHint="Publish a studio note or journal post for your Updates feed."
          getLabel={(item) => item.title || item.excerpt || item.slug || 'Untitled update'}
          onNew={startNewPost}
          onSelect={(item) => {
            setSelectedId(item.slug);
            setIsCreating(false);
            setPostForm({
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
            });
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
        <form className="lg:col-span-2 bg-white rounded-lg border p-6 space-y-4" onSubmit={(event) => { event.preventDefault(); save(selectedPost ? `/api/admin/posts/${selectedPost.slug}` : '/api/admin/posts', selectedPost ? 'PUT' : 'POST', postForm); }}>
          <FormMessage message={message} />
          {selectedPost?.slug && !postForm.isDraft && postForm.visibility !== 'private' && (
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <span className="text-xs text-gray-500">Published update</span>
              <a
                href={`/updates/${encodeURIComponent(selectedPost.slug)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-primary hover:underline"
              >
                View live ↗
              </a>
            </div>
          )}
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
          <ActionRow saving={saving} onDelete={selectedPost ? () => remove(`/api/admin/posts/${selectedPost.slug}`) : undefined} />
        </form>
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
      <SectionIntro title={intro.title} body={intro.body} />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ContentList
        title="Portfolio"
        items={artworks}
        selectedKey={selectedId}
        labelKey="title"
        emptyTitle="No portfolio pieces yet"
        emptyHint="Add works collectors can browse and inquire about."
        onNew={startNewArtwork}
        onSelect={(item) => {
          setSelectedId(item.slug);
          setIsCreating(false);
          setArtworkForm(item);
        }}
      />
      {showArtworkEditor ? (
      <form className="lg:col-span-2 bg-white rounded-lg border p-6 space-y-4" onSubmit={(event) => { event.preventDefault(); save(selectedArtwork ? `/api/admin/artworks/${selectedArtwork.slug}` : '/api/admin/artworks', selectedArtwork ? 'PUT' : 'POST', artworkForm); }}>
        <FormMessage message={message} />
        {selectedArtwork?.slug && (
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <span className="text-xs text-gray-500">Editing portfolio piece</span>
            <a
              href={`/portfolio/${encodeURIComponent(selectedArtwork.slug)}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-primary hover:underline"
            >
              View live ↗
            </a>
          </div>
        )}
        <TextField label="Title" value={artworkForm.title} onChange={(value) => setArtworkForm({ ...artworkForm, title: value })} />
        <TextArea label="Description" value={artworkForm.description} onChange={(value) => setArtworkForm({ ...artworkForm, description: value })} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TextField label="Medium" value={artworkForm.medium} onChange={(value) => setArtworkForm({ ...artworkForm, medium: value })} />
          <TextField label="Dimensions" value={artworkForm.dimensions} onChange={(value) => setArtworkForm({ ...artworkForm, dimensions: value })} />
          <TextField label="Year" value={artworkForm.year} onChange={(value) => setArtworkForm({ ...artworkForm, year: value })} />
        </div>
        <TextField label="Price (display only)" value={artworkForm.price || ''} onChange={(value) => setArtworkForm({ ...artworkForm, price: value })} />
        <p className="text-xs text-gray-500 -mt-2">Shown on the portfolio page. Online checkout still needs a matching product under Products.</p>
        <MediaImageField
          label="Main image"
          value={artworkForm.images?.main || ''}
          onChange={(value) => setArtworkForm({
            ...artworkForm,
            images: { ...artworkForm.images, main: value, thumbnail: artworkForm.images.thumbnail || value },
          })}
        />
        <GalleryField
          label="Additional photos"
          value={artworkForm.images?.gallery || []}
          onChange={(gallery) => setArtworkForm({ ...artworkForm, images: { ...artworkForm.images, gallery } })}
        />
        <TextField
          label="Categories (comma-separated)"
          value={csv(artworkForm.category)}
          onChange={(value) => setArtworkForm({ ...artworkForm, category: list(value) })}
          help="Match keys from Site Content → Portfolio → Categories (for example: paintings, works-on-paper)."
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <CheckboxField label="Featured" checked={Boolean(artworkForm.featured)} onChange={(checked) => setArtworkForm({ ...artworkForm, featured: checked })} />
          <CheckboxField label="Available for inquiry" checked={Boolean(artworkForm.available)} onChange={(checked) => setArtworkForm({ ...artworkForm, available: checked })} />
        </div>
        <RichTextEditor value={artworkForm.content || '<p></p>'} onChange={(content) => setArtworkForm({ ...artworkForm, content })} />
        <ActionRow saving={saving} onDelete={selectedArtwork ? () => remove(`/api/admin/artworks/${selectedArtwork.slug}`) : undefined} />
      </form>
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

function SectionIntro({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
    </div>
  );
}

function EditorPlaceholder({ title, body, onNew }: { title: string; body: string; onNew: () => void }) {
  return (
    <div className="lg:col-span-2 flex flex-col items-start justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-600">{body}</p>
      <button type="button" onClick={onNew} className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        New
      </button>
    </div>
  );
}

function ContentList({ title, items, labelKey, selectedKey, onNew, onSelect, badge, emptyTitle, emptyHint, getLabel, searchable, searchPlaceholder }: {
  title: string;
  items: any[];
  labelKey: string;
  selectedKey?: string | null;
  onNew: () => void;
  onSelect: (item: any) => void;
  badge?: (item: any) => React.ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  getLabel?: (item: any) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = React.useState('');
  const filteredItems = !searchable || !query.trim()
    ? items
    : items.filter((item) => {
        const needle = query.trim().toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags.join(' ') : '';
        const haystack = [
          getLabel ? getLabel(item) : item[labelKey],
          item.slug,
          item.id,
          item.category,
          item.medium,
          tags,
          item.availability,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(needle);
      });

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <button type="button" onClick={onNew} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">New</button>
      </div>
      {searchable && (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder || 'Search…'}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      )}
      <div className="space-y-2 max-h-[36rem] overflow-y-auto">
        {items.length === 0 ? (
          <div className="rounded border border-dashed border-gray-200 px-3 py-6 text-center">
            <p className="text-sm font-medium text-gray-900">{emptyTitle || `No ${title.toLowerCase()} yet`}</p>
            {emptyHint && <p className="mt-1 text-xs text-gray-500">{emptyHint}</p>}
            <button type="button" onClick={onNew} className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-800">
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
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-gray-900">{getLabel ? getLabel(item) : item[labelKey]}</div>
                  {badge?.(item)}
                </div>
                <div className="text-xs text-gray-500">{item.slug || item.id}</div>
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
  return <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
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

function ActionRow({ saving, onDelete }: { saving: boolean; onDelete?: () => void }) {
  return <div className="flex justify-between pt-4"><button type="submit" disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>{onDelete && <button type="button" onClick={onDelete} disabled={saving} className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50">Delete</button>}</div>;
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
      <label className="mt-3 block text-xs font-medium text-gray-700">
        Add email
        <input
          type="email"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="collector@email.com"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const email = event.currentTarget.value.trim().toLowerCase();
            if (!email || !email.includes('@')) return;
            toggle(email, true);
            event.currentTarget.value = '';
          }}
        />
      </label>
    </div>
  );
}

export default AdminContentManager;