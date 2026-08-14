'use client';

import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import RichTextEditor from '@/components/RichTextEditor';

type Section = 'products' | 'posts' | 'artworks';

interface AdminContentManagerProps {
  section: Section;
}

const blankProduct = {
  title: '', description: '', price: 0, currency: 'USD', category: 'paintings', medium: 'Mixed Media', dimensions: '', year: new Date().getFullYear(),
  availability: 'available', featured: false, images: { thumbnail: '', gallery: [] as string[] }, tags: [] as string[],
  shipping: { domestic: 0, international: 0 }, specifications: { framed: false, signed: true, certificate: true },
};

const blankPost = {
  title: '', excerpt: '', content: '<p></p>', publishedAt: new Date().toISOString().slice(0, 10), tags: [] as string[], isDraft: true, featured: false, coverImage: '', author: 'Artist',
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
  const [products, setProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [artworks, setArtworks] = useState<any[]>([]);
  const [productForm, setProductForm] = useState<any>(blankProduct);
  const [postForm, setPostForm] = useState<any>(blankPost);
  const [artworkForm, setArtworkForm] = useState<any>(blankArtwork);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [productResponse, postResponse, artworkResponse] = await Promise.all([
      fetch('/api/admin/products'),
      fetch('/api/admin/posts'),
      fetch('/api/admin/artworks'),
    ]);
    const [productData, postData, artworkData] = await Promise.all([
      productResponse.json(), postResponse.json(), artworkResponse.json()
    ]);
    setProducts(productData.products || []);
    setPosts(Array.isArray(postData) ? postData : postData.posts || []);
    setArtworks(artworkData.artworks || []);
  }

  async function uploadImage(file: File, apply: (url: string) => void) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('/api/upload/image', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Image upload failed');
    apply(data.url);
  }

  async function save(endpoint: string, method: 'POST' | 'PUT', body: unknown) {
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
      await loadAll();
      setSelectedId(null);
      setMessage('Saved successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
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
      setMessage('Deleted successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  if (section === 'products') {
    const selectedProduct = products.find((product) => product.id === selectedId);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContentList title="Products" items={products} labelKey="title" onNew={() => { setSelectedId(null); setProductForm(blankProduct); }} onSelect={(item) => { setSelectedId(item.id); setProductForm(item); }} />
        <form className="lg:col-span-2 bg-white rounded-lg border p-6 space-y-4" onSubmit={(event) => { event.preventDefault(); save(selectedProduct ? `/api/admin/products/${selectedProduct.id}` : '/api/admin/products', selectedProduct ? 'PUT' : 'POST', productForm); }}>
          <FormMessage message={message} />
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
            <SelectField label="Availability" value={productForm.availability} options={['available', 'sold', 'reserved', 'commissioned']} onChange={(value) => setProductForm({ ...productForm, availability: value })} />
          </div>
          <ImageField label="Thumbnail" value={productForm.images?.thumbnail || ''} onUpload={(file) => uploadImage(file, (url) => setProductForm({ ...productForm, images: { ...productForm.images, thumbnail: url, gallery: productForm.images.gallery?.length ? productForm.images.gallery : [url] } }))} onChange={(value) => setProductForm({ ...productForm, images: { ...productForm.images, thumbnail: value } })} />
          <TextArea label="Gallery URLs (comma-separated)" value={csv(productForm.images?.gallery)} onChange={(value) => setProductForm({ ...productForm, images: { ...productForm.images, gallery: list(value) } })} />
          <TextField label="Tags (comma-separated)" value={csv(productForm.tags)} onChange={(value) => setProductForm({ ...productForm, tags: list(value) })} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Domestic Shipping" type="number" value={productForm.shipping?.domestic || 0} onChange={(value) => setProductForm({ ...productForm, shipping: { ...productForm.shipping, domestic: Number(value) } })} />
            <TextField label="International Shipping" type="number" value={productForm.shipping?.international || 0} onChange={(value) => setProductForm({ ...productForm, shipping: { ...productForm.shipping, international: Number(value) } })} />
          </div>
          <CheckboxField label="Featured" checked={Boolean(productForm.featured)} onChange={(checked) => setProductForm({ ...productForm, featured: checked })} />
          <ActionRow saving={saving} onDelete={selectedProduct ? () => remove(`/api/admin/products/${selectedProduct.id}`) : undefined} />
        </form>
      </div>
    );
  }

  if (section === 'posts') {
    const selectedPost = posts.find((post) => post.slug === selectedId);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContentList title="Blog Posts" items={posts} labelKey="title" onNew={() => { setSelectedId(null); setPostForm(blankPost); }} onSelect={(item) => { setSelectedId(item.slug); setPostForm({ ...item, publishedAt: item.publishedAt?.slice(0, 10) || blankPost.publishedAt }); }} />
        <form className="lg:col-span-2 bg-white rounded-lg border p-6 space-y-4" onSubmit={(event) => { event.preventDefault(); save(selectedPost ? `/api/admin/posts/${selectedPost.slug}` : '/api/admin/posts', selectedPost ? 'PUT' : 'POST', postForm); }}>
          <FormMessage message={message} />
          <TextField label="Title" value={postForm.title} onChange={(value) => setPostForm({ ...postForm, title: value })} />
          <TextArea label="Excerpt" value={postForm.excerpt} onChange={(value) => setPostForm({ ...postForm, excerpt: value })} />
          <ImageField label="Cover Image" value={postForm.coverImage || ''} onUpload={(file) => uploadImage(file, (url) => setPostForm({ ...postForm, coverImage: url }))} onChange={(value) => setPostForm({ ...postForm, coverImage: value })} />
          <TextField label="Tags (comma-separated)" value={csv(postForm.tags)} onChange={(value) => setPostForm({ ...postForm, tags: list(value) })} />
          <div className="flex gap-4">
            <CheckboxField label="Draft" checked={Boolean(postForm.isDraft)} onChange={(checked) => setPostForm({ ...postForm, isDraft: checked })} />
            <CheckboxField label="Featured" checked={Boolean(postForm.featured)} onChange={(checked) => setPostForm({ ...postForm, featured: checked })} />
          </div>
          <RichTextEditor value={postForm.content || '<p></p>'} onChange={(content) => setPostForm({ ...postForm, content })} />
          <ActionRow saving={saving} onDelete={selectedPost ? () => remove(`/api/admin/posts/${selectedPost.slug}`) : undefined} />
        </form>
      </div>
    );
  }

  const selectedArtwork = artworks.find((artwork) => artwork.slug === selectedId);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ContentList title="Portfolio" items={artworks} labelKey="title" onNew={() => { setSelectedId(null); setArtworkForm(blankArtwork); }} onSelect={(item) => { setSelectedId(item.slug); setArtworkForm(item); }} />
      <form className="lg:col-span-2 bg-white rounded-lg border p-6 space-y-4" onSubmit={(event) => { event.preventDefault(); save(selectedArtwork ? `/api/admin/artworks/${selectedArtwork.slug}` : '/api/admin/artworks', selectedArtwork ? 'PUT' : 'POST', artworkForm); }}>
        <FormMessage message={message} />
        <TextField label="Title" value={artworkForm.title} onChange={(value) => setArtworkForm({ ...artworkForm, title: value })} />
        <TextArea label="Description" value={artworkForm.description} onChange={(value) => setArtworkForm({ ...artworkForm, description: value })} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TextField label="Medium" value={artworkForm.medium} onChange={(value) => setArtworkForm({ ...artworkForm, medium: value })} />
          <TextField label="Dimensions" value={artworkForm.dimensions} onChange={(value) => setArtworkForm({ ...artworkForm, dimensions: value })} />
          <TextField label="Year" value={artworkForm.year} onChange={(value) => setArtworkForm({ ...artworkForm, year: value })} />
        </div>
        <TextField label="Price" value={artworkForm.price || ''} onChange={(value) => setArtworkForm({ ...artworkForm, price: value })} />
        <ImageField label="Main Image" value={artworkForm.images?.main || ''} onUpload={(file) => uploadImage(file, (url) => setArtworkForm({ ...artworkForm, images: { ...artworkForm.images, main: url, thumbnail: artworkForm.images.thumbnail || url } }))} onChange={(value) => setArtworkForm({ ...artworkForm, images: { ...artworkForm.images, main: value } })} />
        <TextField label="Categories (comma-separated)" value={csv(artworkForm.category)} onChange={(value) => setArtworkForm({ ...artworkForm, category: list(value) })} />
        <div className="flex gap-4">
          <CheckboxField label="Featured" checked={Boolean(artworkForm.featured)} onChange={(checked) => setArtworkForm({ ...artworkForm, featured: checked })} />
          <CheckboxField label="Available" checked={Boolean(artworkForm.available)} onChange={(checked) => setArtworkForm({ ...artworkForm, available: checked })} />
        </div>
        <RichTextEditor value={artworkForm.content || '<p></p>'} onChange={(content) => setArtworkForm({ ...artworkForm, content })} />
        <ActionRow saving={saving} onDelete={selectedArtwork ? () => remove(`/api/admin/artworks/${selectedArtwork.slug}`) : undefined} />
      </form>
    </div>
  );
}

function ContentList({ title, items, labelKey, onNew, onSelect }: { title: string; items: any[]; labelKey: string; onNew: () => void; onSelect: (item: any) => void }) {
  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <button type="button" onClick={onNew} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">New</button>
      </div>
      <div className="space-y-2 max-h-[36rem] overflow-y-auto">
        {items.map((item) => (
          <button key={item.id || item.slug} type="button" onClick={() => onSelect(item)} className="block w-full rounded border border-gray-200 p-3 text-left hover:bg-gray-50">
            <div className="font-medium text-gray-900">{item[labelKey]}</div>
            <div className="text-xs text-gray-500">{item.slug || item.id}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FormMessage({ message }: { message: string | null }) {
  return message ? <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</div> : null;
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-sm font-medium text-gray-700">{label}<input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-gray-700">{label}<textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-gray-700">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function ImageField({ label, value, onChange, onUpload }: { label: string; value: string; onChange: (value: string) => void; onUpload: (file: File) => void }) {
  return <label className="block text-sm font-medium text-gray-700">{label}<input value={value || ''} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" /><input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onUpload(file); }} className="mt-2 block w-full text-sm" /></label>;
}

function ActionRow({ saving, onDelete }: { saving: boolean; onDelete?: () => void }) {
  return <div className="flex justify-between pt-4"><button type="submit" disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>{onDelete && <button type="button" onClick={onDelete} disabled={saving} className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50">Delete</button>}</div>;
}

export default AdminContentManager;