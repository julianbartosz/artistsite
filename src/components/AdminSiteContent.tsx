'use client';

import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import RichTextEditor from '@/components/RichTextEditor';
import type {
  ContactInquiryType,
  NavItem,
  SiteContentByPage,
  SiteContentPage,
} from '@/lib/site-content-shared';
import {
  SITE_CONTENT_DEFAULTS,
  SITE_CONTENT_PAGES,
  SITE_CONTENT_PREVIEW_HREF,
  type HomeSectionKey,
} from '@/lib/site-content-shared';

const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  featured: 'Featured works',
  about: 'About preview',
  blog: 'Blog preview',
  newsletter: 'Newsletter',
};

type ArtworkOption = { slug: string; title: string; featured: boolean };

/** Merge API payload with defaults; validation runs server-side only. */
function assignPage<P extends SiteContentPage>(
  target: SiteContentByPage,
  page: P,
  value: SiteContentByPage[P],
): void {
  target[page] = value;
}

function hydrateSiteContent(data: Record<string, unknown>): SiteContentByPage {
  const next = { ...SITE_CONTENT_DEFAULTS };
  for (const page of SITE_CONTENT_PAGES) {
    const incoming = data[page];
    if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
      assignPage(next, page, incoming as SiteContentByPage[typeof page]);
    }
  }
  return next;
}

const PAGE_TABS: Array<{ key: SiteContentPage; label: string; description: string }> = [
  { key: 'identity', label: 'Branding', description: 'Site name, navigation labels, and which pages appear in the header and footer.' },
  { key: 'home', label: 'Home', description: 'Hero layout, section visibility, featured works, about, blog, and newsletter.' },
  { key: 'bio', label: 'Bio', description: 'Biography sections, rich text, portraits, and which blocks appear on the public page.' },
  { key: 'contact', label: 'Contact', description: 'Form labels, inquiry types, sidebar copy, and response details.' },
  { key: 'portfolio', label: 'Portfolio', description: 'Portfolio page title and introductory copy.' },
  { key: 'shop', label: 'Shop', description: 'Shop copy, search placeholder, and purchase-information blocks.' },
  { key: 'blog', label: 'Blog', description: 'Blog page title, subscribe button, and feed links.' },
];

function reorder<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  const current = next[index];
  next[index] = next[target];
  next[target] = current;
  return next;
}

function TextField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help?: string }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" />
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows = 4, help }: { label: string; value: string; onChange: (value: string) => void; rows?: number; help?: string }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" />
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </label>
  );
}

function SelectField({ label, value, onChange, options, help }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; help?: string }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </label>
  );
}

function CheckboxField({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (value: boolean) => void; help?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm font-medium text-gray-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300" />
      <span>
        {label}
        {help && <span className="block text-xs font-normal text-gray-500">{help}</span>}
      </span>
    </label>
  );
}

function HtmlField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help?: string }) {
  return (
    <div>
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      {help && <p className="mt-1 mb-2 text-xs text-gray-500">{help}</p>}
      <div className="mt-1">
        <RichTextEditor value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function ImageField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help?: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryItems, setLibraryItems] = useState<Array<{ url: string; filename: string }>>([]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/upload/image', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Image upload failed');
      onChange(data.url);
      if (libraryOpen) {
        setLibraryItems((current) => [{ url: data.url, filename: data.filename || data.url }, ...current]);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function openLibrary() {
    setLibraryOpen(true);
    setLibraryLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/upload/image?library=1', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load media library');
      setLibraryItems(Array.isArray(data.items) ? data.items : []);
    } catch (libraryError) {
      setError(libraryError instanceof Error ? libraryError.message : 'Failed to load media library');
      setLibraryItems([]);
    } finally {
      setLibraryLoading(false);
    }
  }

  return (
    <div className="block text-sm font-medium text-gray-700">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
        placeholder="/images/example.jpg"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          {uploading ? 'Uploading...' : 'Upload image'}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          onClick={() => void openLibrary()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Browse library
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
      {value && (
        <img src={value} alt="" className="mt-2 h-24 w-24 rounded object-cover border border-gray-200" />
      )}
      {libraryOpen && (
        <div className="mt-3 rounded-md border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Media library</p>
            <button type="button" onClick={() => setLibraryOpen(false)} className="text-xs text-gray-600 hover:text-gray-900">
              Close
            </button>
          </div>
          {libraryLoading ? (
            <p className="text-xs text-gray-500">Loading images...</p>
          ) : libraryItems.length === 0 ? (
            <p className="text-xs text-gray-500">No uploaded images yet. Upload one to get started.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {libraryItems.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => {
                    onChange(item.url);
                    setLibraryOpen(false);
                  }}
                  className={`relative aspect-square overflow-hidden rounded border ${value === item.url ? 'border-primary ring-2 ring-primary' : 'border-gray-200 hover:border-gray-400'}`}
                  title={item.filename}
                >
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditorSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-md border border-gray-200 p-4">
      <summary className="cursor-pointer font-semibold text-gray-900">{title}</summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}

function OrderedListEditor<T extends { key: string; label: string; visible: boolean }>({
  items,
  extra,
  onChange,
}: {
  items: T[];
  extra?: (item: T, index: number) => React.ReactNode;
  onChange: (items: T[]) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.key} className="rounded-md border border-gray-200 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{item.key}</p>
            <div className="flex gap-2">
              <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-40" disabled={index === 0} onClick={() => onChange(reorder(items, index, -1))}>
                Up
              </button>
              <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-40" disabled={index === items.length - 1} onClick={() => onChange(reorder(items, index, 1))}>
                Down
              </button>
            </div>
          </div>
          <TextField
            label="Label"
            value={item.label}
            onChange={(label) => onChange(items.map((current, currentIndex) => currentIndex === index ? { ...current, label } : current))}
          />
          <CheckboxField
            label="Visible"
            checked={item.visible}
            onChange={(visible) => onChange(items.map((current, currentIndex) => currentIndex === index ? { ...current, visible } : current))}
          />
          {extra?.(item, index)}
        </div>
      ))}
    </div>
  );
}

export default function AdminSiteContent() {
  const [activePage, setActivePage] = useState<SiteContentPage>('identity');
  const [content, setContent] = useState<SiteContentByPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState(0);
  const [artworkOptions, setArtworkOptions] = useState<ArtworkOption[]>([]);

  async function loadContent() {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/admin/site-content', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load site content');
      setContent(hydrateSiteContent(data));
    } catch (error) {
      setContent(null);
      setLoadError(error instanceof Error ? error.message : 'Failed to load site content');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContent();
    fetch('/api/admin/artworks', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.artworks)) {
          setArtworkOptions(
            data.artworks.map((artwork: ArtworkOption) => ({
              slug: artwork.slug,
              title: artwork.title,
              featured: artwork.featured,
            })),
          );
        }
      })
      .catch(() => undefined);
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!content) return;

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/site-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: activePage, content: content[activePage] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save site content');
      if (data.content) {
        setContent((current) => {
          if (!current) return current;
          const next = { ...current };
          assignPage(next, activePage, data.content as SiteContentByPage[typeof activePage]);
          return next;
        });
      }
      setMessage('Site content saved. Preview updated below.');
      setPreviewToken((current) => current + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save site content');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !content) {
    return (
      <div className="rounded-lg border bg-white p-6 text-gray-600">
        <p>Loading site pages...</p>
        <button type="button" onClick={() => void loadContent()} className="mt-3 text-sm font-medium text-gray-900 underline">
          Retry
        </button>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        <p>{loadError || 'Site pages could not be loaded.'}</p>
        <button type="button" onClick={() => void loadContent()} className="mt-3 text-sm font-medium underline">
          Retry
        </button>
      </div>
    );
  }

  const activeTab = PAGE_TABS.find((tab) => tab.key === activePage)!;
  const previewHref = SITE_CONTENT_PREVIEW_HREF[activePage];

  return (
    <div className="space-y-6" data-testid="site-content-editor">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Edit public page copy and structure here without touching code. Routes stay fixed so navigation cannot point at broken URLs. Blog posts, portfolio items, and products are managed in their own tabs.
      </div>

      <div className="flex flex-wrap gap-2">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActivePage(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${activePage === tab.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{activeTab.label}</h2>
            <p className="mt-1 text-sm text-gray-600">{activeTab.description}</p>
          </div>
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View page
          </a>
        </div>

        {message && (
          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</div>
        )}

        {activePage === 'identity' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label="Site name" value={content.identity.siteName} onChange={(value) => setContent({ ...content, identity: { ...content.identity, siteName: value } })} help="Used in page titles, footer, and metadata." />
              <TextField label="Header name" value={content.identity.headerName} onChange={(value) => setContent({ ...content, identity: { ...content.identity, headerName: value } })} help="Optional shorter name for the navigation bar. Leave blank to use the full site name." />
              <TextField label="Copyright name" value={content.identity.copyrightName} onChange={(value) => setContent({ ...content, identity: { ...content.identity, copyrightName: value } })} />
              <div className="md:col-span-2">
                <TextAreaField label="Header/footer tagline" value={content.identity.tagline} onChange={(value) => setContent({ ...content, identity: { ...content.identity, tagline: value } })} />
              </div>
              <div className="md:col-span-2">
                <TextField label="Footer note" value={content.identity.footerTagline} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footerTagline: value } })} />
              </div>
            </div>
            <EditorSection title="Theme" defaultOpen>
              <p className="text-sm text-gray-600">Colors and typography apply site-wide through CSS variables.</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <TextField
                  label="Primary color"
                  value={content.identity.theme.primaryColor}
                  onChange={(value) => setContent({
                    ...content,
                    identity: { ...content.identity, theme: { ...content.identity.theme, primaryColor: value } },
                  })}
                  help="Hex color for buttons, header accents, and footer background."
                />
                <TextField
                  label="Accent color"
                  value={content.identity.theme.accentColor}
                  onChange={(value) => setContent({
                    ...content,
                    identity: { ...content.identity, theme: { ...content.identity.theme, accentColor: value } },
                  })}
                  help="Secondary brand color for links and highlights."
                />
                <SelectField
                  label="Font preset"
                  value={content.identity.theme.fontPreset}
                  onChange={(value) => setContent({
                    ...content,
                    identity: {
                      ...content.identity,
                      theme: { ...content.identity.theme, fontPreset: value as typeof content.identity.theme.fontPreset },
                    },
                  })}
                  options={[
                    { value: 'system', label: 'System sans-serif' },
                    { value: 'serif', label: 'Classic serif' },
                    { value: 'modern', label: 'Modern sans-serif' },
                  ]}
                />
              </div>
            </EditorSection>
            <EditorSection title="Footer columns">
              <TextField label="Quick links heading" value={content.identity.footer.quickLinksHeading} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, quickLinksHeading: value } } })} />
              <TextField label="Legal heading" value={content.identity.footer.legalHeading} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, legalHeading: value } } })} />
              <CheckboxField label="Show legal links" checked={content.identity.footer.showLegal} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, showLegal: value } } })} />
              <CheckboxField label="Show extra footer column" checked={content.identity.footer.extraColumn.show} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, extraColumn: { ...content.identity.footer.extraColumn, show: value } } } })} />
              <TextField label="Extra column heading" value={content.identity.footer.extraColumn.heading} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, extraColumn: { ...content.identity.footer.extraColumn, heading: value } } } })} help="For example: Studio hours, Visit us, or Press kit." />
              <HtmlField label="Extra column body" value={content.identity.footer.extraColumn.bodyHtml} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, extraColumn: { ...content.identity.footer.extraColumn, bodyHtml: value } } } })} />
            </EditorSection>
            <EditorSection title="Navigation" defaultOpen>
              <p className="text-sm text-gray-600">Reorder pages, rename links, and hide them from the header or footer. Destinations stay locked to existing site routes.</p>
              <OrderedListEditor
                items={content.identity.navigation}
                onChange={(navigation: NavItem[]) => setContent({ ...content, identity: { ...content.identity, navigation } })}
                extra={(item, index) => (
                  <CheckboxField
                    label="Show in footer"
                    checked={item.showInFooter}
                    onChange={(showInFooter) => setContent({
                      ...content,
                      identity: {
                        ...content.identity,
                        navigation: content.identity.navigation.map((current, currentIndex) => currentIndex === index ? { ...current, showInFooter } : current),
                      },
                    })}
                  />
                )}
              />
            </EditorSection>
          </div>
        )}

        {activePage === 'home' && (
          <div className="space-y-4">
            <EditorSection title="Section order" defaultOpen>
              <p className="text-sm text-gray-600">Control which blocks appear on the homepage and in what order. The hero always stays at the top. Hide individual sections in their own panels below.</p>
              <div className="space-y-3">
                {content.home.sectionOrder.map((sectionKey, index) => (
                  <div key={sectionKey} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                    <span className="text-sm font-medium text-gray-900">{HOME_SECTION_LABELS[sectionKey]}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() => setContent({
                          ...content,
                          home: { ...content.home, sectionOrder: reorder(content.home.sectionOrder, index, -1) },
                        })}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                        disabled={index === content.home.sectionOrder.length - 1}
                        onClick={() => setContent({
                          ...content,
                          home: { ...content.home, sectionOrder: reorder(content.home.sectionOrder, index, 1) },
                        })}
                      >
                        Down
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </EditorSection>
            <EditorSection title="Hero layout" defaultOpen>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Hero height"
                  value={content.home.hero.height}
                  onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, height: value as typeof content.home.hero.height } } })}
                  options={[
                    { value: 'compact', label: 'Compact — artwork appears sooner' },
                    { value: 'full', label: 'Full screen' },
                  ]}
                />
                <SelectField
                  label="Portrait placement"
                  value={content.home.hero.imagePlacement}
                  onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, imagePlacement: value as typeof content.home.hero.imagePlacement } } })}
                  options={[
                    { value: 'inline', label: 'Beside the headline' },
                    { value: 'badge', label: 'Small circle below the buttons' },
                    { value: 'background', label: 'Full-bleed background image' },
                  ]}
                />
                <SelectField
                  label="Primary button"
                  value={content.home.hero.primaryCta}
                  onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, primaryCta: value as typeof content.home.hero.primaryCta } } })}
                  options={[
                    { value: 'shop', label: 'Shop' },
                    { value: 'portfolio', label: 'Portfolio' },
                    { value: 'contact', label: 'Contact' },
                  ]}
                  help="The filled button. Other buttons become outlines."
                />
                <CheckboxField
                  label="Show secondary hero buttons"
                  checked={content.home.hero.showSecondaryCtas}
                  onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, showSecondaryCtas: value } } })}
                  help="Turn off to show only the primary button."
                />
              </div>
            </EditorSection>
            <EditorSection title="Hero copy" defaultOpen>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Title line 1" value={content.home.hero.titleLine1} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, titleLine1: value } } })} />
                <TextField label="Title line 2" value={content.home.hero.titleLine2} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, titleLine2: value } } })} />
                <div className="md:col-span-2"><TextAreaField label="Subtitle" value={content.home.hero.subtitle} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, subtitle: value } } })} /></div>
                <TextField label="Shop button" value={content.home.hero.ctaShop} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, ctaShop: value } } })} />
                <TextField label="Portfolio button" value={content.home.hero.ctaPortfolio} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, ctaPortfolio: value } } })} />
                <TextField label="Contact button" value={content.home.hero.ctaContact} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, ctaContact: value } } })} />
                <div className="md:col-span-2">
                  <ImageField label="Portrait image" value={content.home.hero.portraitImage} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, portraitImage: value } } })} help="Upload an image or paste a path. Leave blank to hide." />
                </div>
              </div>
            </EditorSection>
            <EditorSection title="Featured works">
              <CheckboxField label="Show this section" checked={content.home.featured.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, featured: { ...content.home.featured, showSection: value } } })} />
              <SelectField
                label="Which works to show"
                value={content.home.featured.selectionMode}
                onChange={(value) => setContent({
                  ...content,
                  home: {
                    ...content.home,
                    featured: { ...content.home.featured, selectionMode: value as typeof content.home.featured.selectionMode },
                  },
                })}
                options={[
                  { value: 'featured_flag', label: 'Portfolio items marked featured' },
                  { value: 'latest', label: 'Latest portfolio items' },
                  { value: 'manual', label: 'Pick specific works' },
                ]}
              />
              <TextField
                label="Number of works"
                value={String(content.home.featured.limit)}
                onChange={(value) => {
                  const parsed = Number.parseInt(value, 10);
                  if (!Number.isFinite(parsed)) return;
                  setContent({
                    ...content,
                    home: { ...content.home, featured: { ...content.home.featured, limit: Math.min(12, Math.max(1, parsed)) } },
                  });
                }}
                help="Between 1 and 12."
              />
              {content.home.featured.selectionMode === 'manual' && (
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-gray-700">Selected works (in order)</span>
                  {artworkOptions.length === 0 ? (
                    <p className="text-sm text-gray-500">Add portfolio items in the Content tab first.</p>
                  ) : (
                    artworkOptions.map((artwork) => {
                      const selected = content.home.featured.manualSlugs.includes(artwork.slug);
                      return (
                        <label key={artwork.slug} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              const manualSlugs = event.target.checked
                                ? [...content.home.featured.manualSlugs, artwork.slug]
                                : content.home.featured.manualSlugs.filter((slug) => slug !== artwork.slug);
                              setContent({
                                ...content,
                                home: { ...content.home, featured: { ...content.home.featured, manualSlugs } },
                              });
                            }}
                          />
                          <span>{artwork.title}{artwork.featured ? ' (featured)' : ''}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
              <TextField label="Section title" value={content.home.featured.title} onChange={(value) => setContent({ ...content, home: { ...content.home, featured: { ...content.home.featured, title: value } } })} />
              <TextAreaField label="Section description" value={content.home.featured.description} onChange={(value) => setContent({ ...content, home: { ...content.home, featured: { ...content.home.featured, description: value } } })} />
              <TextField label="View-all link text" value={content.home.featured.cta} onChange={(value) => setContent({ ...content, home: { ...content.home, featured: { ...content.home.featured, cta: value } } })} />
              <CheckboxField
                label="Show artwork descriptions under thumbnails"
                checked={content.home.featured.showDescriptions}
                onChange={(value) => setContent({ ...content, home: { ...content.home, featured: { ...content.home.featured, showDescriptions: value } } })}
              />
            </EditorSection>
            <EditorSection title="About preview">
              <CheckboxField label="Show this section" checked={content.home.about.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, showSection: value } } })} />
              <TextField label="Section title" value={content.home.about.title} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, title: value } } })} />
              <TextAreaField label="First paragraph" value={content.home.about.paragraph1} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, paragraph1: value } } })} />
              <TextAreaField label="Second paragraph" value={content.home.about.paragraph2} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, paragraph2: value } } })} />
              <TextField label="Call-to-action button" value={content.home.about.cta} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, cta: value } } })} />
              <ImageField label="Studio image" value={content.home.about.studioImage} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, studioImage: value } } })} help="Leave blank to hide the image." />
            </EditorSection>
            <EditorSection title="Blog preview">
              <CheckboxField label="Show this section" checked={content.home.blog.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, showSection: value } } })} />
              <TextField label="Section title" value={content.home.blog.title} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, title: value } } })} />
              <TextAreaField label="Section description" value={content.home.blog.description} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, description: value } } })} />
              <TextField label="View-all link text" value={content.home.blog.cta} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, cta: value } } })} />
            </EditorSection>
            <EditorSection title="Newsletter">
              <CheckboxField label="Show this section" checked={content.home.newsletter.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, showSection: value } } })} />
              <TextField label="Section title" value={content.home.newsletter.title} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, title: value } } })} />
              <TextAreaField label="Section description" value={content.home.newsletter.description} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, description: value } } })} />
              <TextField label="Email placeholder" value={content.home.newsletter.placeholder} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, placeholder: value } } })} />
              <TextField label="Subscribe button" value={content.home.newsletter.buttonLabel} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, buttonLabel: value } } })} />
              <TextField label="Disclaimer" value={content.home.newsletter.disclaimer} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, disclaimer: value } } })} />
            </EditorSection>
          </div>
        )}

        {activePage === 'bio' && (
          <div className="space-y-4">
            <EditorSection title="Visible sections" defaultOpen>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <CheckboxField label="Artist statement" checked={content.bio.showStatement} onChange={(value) => setContent({ ...content, bio: { ...content.bio, showStatement: value } })} />
                <CheckboxField label="Background" checked={content.bio.showBackground} onChange={(value) => setContent({ ...content, bio: { ...content.bio, showBackground: value } })} />
                <CheckboxField label="Achievements" checked={content.bio.showAchievements} onChange={(value) => setContent({ ...content, bio: { ...content.bio, showAchievements: value } })} />
                <CheckboxField label="Studio practice" checked={content.bio.showStudio} onChange={(value) => setContent({ ...content, bio: { ...content.bio, showStudio: value } })} />
                <CheckboxField label="Collections and press" checked={content.bio.showCollections} onChange={(value) => setContent({ ...content, bio: { ...content.bio, showCollections: value } })} />
                <CheckboxField label="Closing call to action" checked={content.bio.showCta} onChange={(value) => setContent({ ...content, bio: { ...content.bio, showCta: value } })} />
              </div>
            </EditorSection>
            <EditorSection title="Hero" defaultOpen>
              <TextField label="Hero title" value={content.bio.hero.title} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, title: value } } })} />
              <TextAreaField label="Hero subtitle" value={content.bio.hero.subtitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, subtitle: value } } })} />
              <ImageField label="Portrait image" value={content.bio.hero.portraitImage} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, portraitImage: value } } })} help="Leave blank to hide." />
              <TextField label="Hero portfolio button" value={content.bio.hero.ctaPortfolio} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, ctaPortfolio: value } } })} help="Leave blank to hide this button." />
              <TextField label="Hero contact button" value={content.bio.hero.ctaContact} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, ctaContact: value } } })} help="Leave blank to hide this button." />
            </EditorSection>
            <EditorSection title="Statement and studio">
              <TextField label="Artist statement heading" value={content.bio.statementTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, statementTitle: value } })} />
              <HtmlField label="Artist statement" value={content.bio.artistStatementHtml} onChange={(value) => setContent({ ...content, bio: { ...content.bio, artistStatementHtml: value } })} />
              <TextField label="Studio section heading" value={content.bio.studioTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioTitle: value } })} />
              <ImageField label="Studio image" value={content.bio.studioImage} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioImage: value } })} />
              <HtmlField label="Studio practice section" value={content.bio.studioPracticeHtml} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioPracticeHtml: value } })} />
            </EditorSection>
            <EditorSection title="Background and achievements">
              <TextField label="Background heading" value={content.bio.backgroundTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, backgroundTitle: value } })} />
              <HtmlField label="Background section" value={content.bio.backgroundHtml} help="Education and professional experience." onChange={(value) => setContent({ ...content, bio: { ...content.bio, backgroundHtml: value } })} />
              <TextField label="Achievements heading" value={content.bio.achievementsTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, achievementsTitle: value } })} />
              <HtmlField label="Achievements section" value={content.bio.achievementsHtml} onChange={(value) => setContent({ ...content, bio: { ...content.bio, achievementsHtml: value } })} />
            </EditorSection>
            <EditorSection title="Collections and closing">
              <TextField label="Collections heading" value={content.bio.collectionsTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, collectionsTitle: value } })} />
              <HtmlField label="Collections and press section" value={content.bio.collectionsHtml} onChange={(value) => setContent({ ...content, bio: { ...content.bio, collectionsHtml: value } })} />
              <TextField label="Closing section title" value={content.bio.cta.title} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, title: value } } })} />
              <TextAreaField label="Closing section subtitle" value={content.bio.cta.subtitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, subtitle: value } } })} />
              <TextField label="Closing portfolio button" value={content.bio.cta.portfolioLabel} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, portfolioLabel: value } } })} help="Leave blank to hide." />
              <TextField label="Closing shop button" value={content.bio.cta.shopLabel} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, shopLabel: value } } })} help="Leave blank to hide." />
              <TextField label="Closing contact button" value={content.bio.cta.contactLabel} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, contactLabel: value } } })} help="Leave blank to hide." />
            </EditorSection>
          </div>
        )}

        {activePage === 'contact' && (
          <div className="space-y-4">
            <EditorSection title="Page and form" defaultOpen>
              <TextField label="Page title" value={content.contact.header.title} onChange={(value) => setContent({ ...content, contact: { ...content.contact, header: { ...content.contact.header, title: value } } })} />
              <TextAreaField label="Page subtitle" value={content.contact.header.subtitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, header: { ...content.contact.header, subtitle: value } } })} />
              <TextField label="Form heading" value={content.contact.form.title} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, title: value } } })} />
              <TextAreaField label="Success message" value={content.contact.form.successMessage} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, successMessage: value } } })} />
              <TextField label="Inquiry label" value={content.contact.form.inquiryLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, inquiryLabel: value } } })} />
              <TextField label="Name label" value={content.contact.form.nameLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, nameLabel: value } } })} />
              <TextField label="Email label" value={content.contact.form.emailLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, emailLabel: value } } })} />
              <TextField label="Subject label" value={content.contact.form.subjectLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, subjectLabel: value } } })} />
              <TextField label="Message label" value={content.contact.form.messageLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, messageLabel: value } } })} />
              <TextField label="Submit button" value={content.contact.form.submitLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, submitLabel: value } } })} />
              <TextField label="Name placeholder" value={content.contact.form.namePlaceholder} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, namePlaceholder: value } } })} />
              <TextField label="Email placeholder" value={content.contact.form.emailPlaceholder} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, emailPlaceholder: value } } })} />
              <TextField label="Subject placeholder" value={content.contact.form.subjectPlaceholder} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, subjectPlaceholder: value } } })} />
              <TextAreaField label="Message placeholder" value={content.contact.form.messagePlaceholder} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, messagePlaceholder: value } } })} />
            </EditorSection>
            <EditorSection title="Inquiry types">
              <p className="text-sm text-gray-600">Hide types you do not use, rename them, and set the order visitors see. Hidden types stay valid if a previous form submission used them.</p>
              <OrderedListEditor
                items={content.contact.form.inquiryTypes}
                onChange={(inquiryTypes: ContactInquiryType[]) => setContent({
                  ...content,
                  contact: { ...content.contact, form: { ...content.contact.form, inquiryTypes } },
                })}
              />
            </EditorSection>
            <EditorSection title="Sidebar">
              <TextField label="Sidebar heading" value={content.contact.sidebar.connectTitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, connectTitle: value } } })} />
              <TextAreaField label="Sidebar intro" value={content.contact.sidebar.connectText} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, connectText: value } } })} />
              <TextField label="Contact info heading" value={content.contact.sidebar.contactInfoTitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, contactInfoTitle: value } } })} />
              <TextField label="Location" value={content.contact.sidebar.location} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, location: value } } })} />
              <TextField label="Instagram handle" value={content.contact.sidebar.instagramHandle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, instagramHandle: value } } })} />
              <TextField label="Response time heading" value={content.contact.sidebar.responseTimeTitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, responseTimeTitle: value } } })} />
              <HtmlField label="Response time block" value={content.contact.sidebar.responseTimeHtml} help="Collapses on phones." onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, responseTimeHtml: value } } })} />
              <TextField label="Commission heading" value={content.contact.sidebar.commissionTitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, commissionTitle: value } } })} />
              <HtmlField label="Commission info block" value={content.contact.sidebar.commissionHtml} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, commissionHtml: value } } })} />
              <ImageField label="Portrait image" value={content.contact.portraitImage} onChange={(value) => setContent({ ...content, contact: { ...content.contact, portraitImage: value } })} />
            </EditorSection>
          </div>
        )}

        {activePage === 'portfolio' && (
          <div className="space-y-4">
            <SelectField
              label="Listing header size"
              value={content.portfolio.hero.height}
              onChange={(value) => setContent({ ...content, portfolio: { ...content.portfolio, hero: { ...content.portfolio.hero, height: value as typeof content.portfolio.hero.height } } })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'full', label: 'Spacious' },
              ]}
            />
            <TextField label="Page title" value={content.portfolio.title} onChange={(value) => setContent({ ...content, portfolio: { ...content.portfolio, title: value } })} />
            <TextAreaField label="Page subtitle" value={content.portfolio.subtitle} onChange={(value) => setContent({ ...content, portfolio: { ...content.portfolio, subtitle: value } })} />
            <EditorSection title="Gallery layout" defaultOpen>
              <SelectField
                label="Grid columns"
                value={content.portfolio.layout.gridColumns}
                onChange={(value) => setContent({
                  ...content,
                  portfolio: {
                    ...content.portfolio,
                    layout: { ...content.portfolio.layout, gridColumns: value as typeof content.portfolio.layout.gridColumns },
                  },
                })}
                options={[
                  { value: '2', label: '2 columns' },
                  { value: '3', label: '3 columns' },
                  { value: '4', label: '4 columns' },
                ]}
              />
              <CheckboxField label="Show category filters" checked={content.portfolio.layout.showFilters} onChange={(value) => setContent({ ...content, portfolio: { ...content.portfolio, layout: { ...content.portfolio.layout, showFilters: value } } })} />
              <CheckboxField label="Masonry layout" checked={content.portfolio.layout.masonry} onChange={(value) => setContent({ ...content, portfolio: { ...content.portfolio, layout: { ...content.portfolio.layout, masonry: value } } })} help="Taller portrait crops instead of uniform squares." />
            </EditorSection>
          </div>
        )}

        {activePage === 'shop' && (
          <div className="space-y-4">
            <SelectField
              label="Listing header size"
              value={content.shop.hero.height}
              onChange={(value) => setContent({ ...content, shop: { ...content.shop, hero: { ...content.shop.hero, height: value as typeof content.shop.hero.height } } })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'full', label: 'Spacious' },
              ]}
            />
            <TextField label="Page title" value={content.shop.title} onChange={(value) => setContent({ ...content, shop: { ...content.shop, title: value } })} />
            <TextAreaField label="Page subtitle" value={content.shop.subtitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, subtitle: value } })} />
            <TextField label="Search placeholder" value={content.shop.searchPlaceholder} onChange={(value) => setContent({ ...content, shop: { ...content.shop, searchPlaceholder: value } })} />
            <CheckboxField label="Show recently viewed" checked={content.shop.showRecentlyViewed} onChange={(value) => setContent({ ...content, shop: { ...content.shop, showRecentlyViewed: value } })} />
            <CheckboxField label="Show recommendations" checked={content.shop.showRecommendations} onChange={(value) => setContent({ ...content, shop: { ...content.shop, showRecommendations: value } })} help="Shown to all visitors; guests see featured works." />
            <TextAreaField label="Checkout trust copy" value={content.shop.checkoutTrustCopy} onChange={(value) => setContent({ ...content, shop: { ...content.shop, checkoutTrustCopy: value } })} help="Displayed below the pay button on checkout." />
            <EditorSection title="Purchase information">
              <CheckboxField label="Show this section" checked={content.shop.showPurchaseInfo} onChange={(value) => setContent({ ...content, shop: { ...content.shop, showPurchaseInfo: value } })} />
              <TextField label="Section title" value={content.shop.purchaseInfo.title} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, title: value } } })} />
              <TextField label="Authenticity heading" value={content.shop.purchaseInfo.authenticityTitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, authenticityTitle: value } } })} />
              <TextAreaField label="Authenticity text" value={content.shop.purchaseInfo.authenticityText} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, authenticityText: value } } })} />
              <TextField label="Shipping heading" value={content.shop.purchaseInfo.shippingTitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, shippingTitle: value } } })} />
              <TextAreaField label="Shipping text" value={content.shop.purchaseInfo.shippingText} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, shippingText: value } } })} />
              <TextField label="Commissions heading" value={content.shop.purchaseInfo.commissionsTitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, commissionsTitle: value } } })} />
              <TextAreaField label="Commissions text" value={content.shop.purchaseInfo.commissionsText} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, commissionsText: value } } })} />
              <TextField label="Contact button" value={content.shop.purchaseInfo.ctaLabel} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, ctaLabel: value } } })} help="Leave blank to hide." />
            </EditorSection>
          </div>
        )}

        {activePage === 'blog' && (
          <div className="space-y-4">
            <SelectField
              label="Listing header size"
              value={content.blog.hero.height}
              onChange={(value) => setContent({ ...content, blog: { ...content.blog, hero: { ...content.blog.hero, height: value as typeof content.blog.hero.height } } })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'full', label: 'Spacious' },
              ]}
            />
            <TextField label="Page title" value={content.blog.title} onChange={(value) => setContent({ ...content, blog: { ...content.blog, title: value } })} />
            <TextAreaField label="Page subtitle" value={content.blog.subtitle} onChange={(value) => setContent({ ...content, blog: { ...content.blog, subtitle: value } })} />
            <CheckboxField label="Show subscribe button" checked={content.blog.showSubscribe} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showSubscribe: value } })} />
            <TextField label="Subscribe button label" value={content.blog.subscribeLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, subscribeLabel: value } })} />
            <CheckboxField label="Show RSS and Atom feeds" checked={content.blog.showRss} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showRss: value } })} />
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary px-5 py-2 rounded disabled:opacity-50">
            {saving ? 'Saving...' : `Save ${activeTab.label}`}
          </button>
        </div>
      </form>

      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Live preview</h3>
            <p className="text-xs text-gray-500">Refreshes after each save for the active tab.</p>
          </div>
          <a href={`${previewHref}?preview=${previewToken}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:opacity-80">
            Open full page
          </a>
        </div>
        <iframe
          key={`${activePage}-${previewToken}`}
          title={`Preview ${activeTab.label}`}
          src={`${previewHref}?preview=${previewToken}`}
          className="w-full h-[720px] bg-white"
        />
      </div>
    </div>
  );
}
