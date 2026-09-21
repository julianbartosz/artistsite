'use client';

import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RichTextEditor from '@/components/RichTextEditor';
import { ThemeColorEditor } from '@/components/admin/ColorField';
import MediaImageField from '@/components/admin/MediaImageField';
import CommissionIntakeWizard from '@/components/admin/CommissionIntakeWizard';
import { useLiveSiteTheme } from '@/components/admin/useLiveSiteTheme';
import { cmsSectionElementId } from '@/lib/cms-edit-map';
import type {
  ContactInquiryType,
  NavItem,
  SiteContentByPage,
  SiteContentPage,
  BioSectionKey,
} from '@/lib/site-content-shared';
import {
  SITE_CONTENT_DEFAULTS,
  SITE_CONTENT_PAGES,
  SITE_CONTENT_PREVIEW_HREF,
  headerDisplayName,
  visibleNavItems,
  type HomeSectionKey,
} from '@/lib/site-content-shared';

const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  featured: 'Artwork spotlight',
  about: 'About preview',
  blog: 'Updates preview',
  newsletter: 'Newsletter',
};

const BIO_SECTION_LABELS: Record<BioSectionKey, string> = {
  statement: 'Artist statement',
  background: 'Background',
  achievements: 'Achievements',
  studio: 'Studio practice',
  collections: 'Collections and press',
  cta: 'Closing call to action',
};

const NAV_PAGE_LABELS: Record<string, string> = {
  home: 'Home page',
  portfolio: 'Portfolio',
  shop: 'Shop',
  blog: 'Updates',
  bio: 'Bio',
  contact: 'Contact',
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
  { key: 'identity', label: 'Branding', description: 'Site appearance, colors, layout structure, navigation, and footer.' },
  { key: 'home', label: 'Home', description: 'Top banner, homepage blocks, artwork spotlight, about, blog, and newsletter.' },
  { key: 'bio', label: 'Bio', description: 'Biography sections, rich text, portraits, and which blocks appear on the public page.' },
  { key: 'contact', label: 'Contact', description: 'Form labels, inquiry types, sidebar copy, and response details.' },
  { key: 'portfolio', label: 'Portfolio', description: 'Portfolio page title and introductory copy.' },
  { key: 'shop', label: 'Shop', description: 'Shop copy, search placeholder, and purchase-information blocks.' },
  { key: 'blog', label: 'Updates', description: 'Public feed, studio/journal filters, collector-only section, and subscribe links.' },
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

function HeroImagePlacementPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = [
    { value: 'inline', label: 'Beside the headline', preview: (
      <div className="flex h-12 w-full gap-1 rounded border border-gray-300 bg-gray-50 p-1">
        <div className="flex flex-1 flex-col justify-center gap-0.5 px-1">
          <div className="h-1 w-3/4 rounded bg-gray-400" />
          <div className="h-1 w-1/2 rounded bg-gray-300" />
        </div>
        <div className="w-5 rounded bg-gray-400" />
      </div>
    ) },
    { value: 'badge', label: 'Small circle below buttons', preview: (
      <div className="flex h-12 w-full flex-col items-center justify-center gap-1 rounded border border-gray-300 bg-gray-50 p-1">
        <div className="h-1 w-2/3 rounded bg-gray-400" />
        <div className="h-3 w-3 rounded-full bg-gray-400" />
      </div>
    ) },
    { value: 'background', label: 'Full background image', preview: (
      <div className="relative h-12 w-full overflow-hidden rounded border border-gray-300 bg-gray-400 p-1">
        <div className="absolute inset-0 bg-gray-500/60" />
        <div className="relative flex h-full flex-col justify-center gap-0.5 px-1">
          <div className="h-1 w-2/3 rounded bg-white/90" />
          <div className="h-1 w-1/2 rounded bg-white/70" />
        </div>
      </div>
    ) },
  ] as const;

  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700">Where your photo appears</legend>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-md border p-2 ${value === option.value ? 'border-primary ring-2 ring-primary' : 'border-gray-200 hover:border-gray-400'}`}
          >
            <input
              type="radio"
              name="hero-image-placement"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.preview}
            <span className="mt-1 block text-xs text-gray-700">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EditorSection({ title, children, defaultOpen = false, id }: { title: string; children: React.ReactNode; defaultOpen?: boolean; id?: string }) {
  return (
    <details id={id} open={defaultOpen} className="rounded-md border border-gray-200 p-4">
      <summary className="cursor-pointer font-semibold text-gray-900">{title}</summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}

function LegalPagesEditor() {
  const [privacyHtml, setPrivacyHtml] = useState('');
  const [termsHtml, setTermsHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((response) => response.json())
      .then((data) => {
        const records = Object.fromEntries((data.settings || []).map((item: { key: string; value?: string }) => [item.key, item.value || '']));
        setPrivacyHtml(records.LEGAL_PRIVACY_HTML || '');
        setTermsHtml(records.LEGAL_TERMS_HTML || '');
      })
      .catch(() => setMessage('Could not load legal pages.'))
      .finally(() => setLoading(false));
  }, []);

  async function saveLegalPages() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            LEGAL_PRIVACY_HTML: privacyHtml,
            LEGAL_TERMS_HTML: termsHtml,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save legal pages');
      setMessage('Legal pages saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save legal pages');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading legal pages…</p>;
  }

  return (
    <div className="space-y-4">
      <HtmlField label="Privacy policy" value={privacyHtml} onChange={setPrivacyHtml} help="Shown at /privacy." />
      <HtmlField label="Terms of service" value={termsHtml} onChange={setTermsHtml} help="Shown at /terms." />
      {message && <p className="text-sm text-gray-700">{message}</p>}
      <button type="button" onClick={() => void saveLegalPages()} disabled={saving} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50">
        {saving ? 'Saving legal pages…' : 'Save legal pages'}
      </button>
    </div>
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
            <p className="text-sm font-semibold text-gray-900">{NAV_PAGE_LABELS[item.key] || item.key}</p>
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
  const searchParams = useSearchParams();
  const [activePage, setActivePage] = useState<SiteContentPage>('identity');
  const [content, setContent] = useState<SiteContentByPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState(0);
  const [artworkOptions, setArtworkOptions] = useState<ArtworkOption[]>([]);
  const savedBaselineRef = useRef<string>('');
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = content ? JSON.stringify(content) !== savedBaselineRef.current : false;

  useLiveSiteTheme(content?.identity.theme);

  const appearanceDirty = content && savedBaselineRef.current ? (() => {
    try {
      const baseline = JSON.parse(savedBaselineRef.current) as SiteContentByPage;
      const currentAppearance = {
        theme: content.identity.theme,
        homeLayout: content.home.layoutTemplate,
        shopLayout: content.shop.layout,
        portfolioLayout: content.portfolio.layout,
      };
      const savedAppearance = {
        theme: baseline.identity.theme,
        homeLayout: baseline.home.layoutTemplate,
        shopLayout: baseline.shop.layout,
        portfolioLayout: baseline.portfolio.layout,
      };
      return JSON.stringify(currentAppearance) !== JSON.stringify(savedAppearance);
    } catch {
      return false;
    }
  })() : false;

  function revertAppearance() {
    if (!content || !savedBaselineRef.current) return;
    try {
      const baseline = JSON.parse(savedBaselineRef.current) as SiteContentByPage;
      setContent({
        ...content,
        identity: {
          ...content.identity,
          theme: baseline.identity.theme,
        },
        home: {
          ...content.home,
          layoutTemplate: baseline.home.layoutTemplate,
        },
        shop: {
          ...content.shop,
          layout: { ...baseline.shop.layout },
        },
        portfolio: {
          ...content.portfolio,
          layout: { ...baseline.portfolio.layout },
        },
      });
    } catch {
      // Ignore malformed baseline snapshots.
    }
  }

  const pushPreview = useCallback(async (snapshot: SiteContentByPage) => {
    try {
      await fetch('/api/admin/site-content/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(snapshot),
      });
      setPreviewToken((current) => current + 1);
    } catch {
      // Preview failures should not block editing.
    }
  }, []);

  async function loadContent() {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/admin/site-content', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load site content');
      const hydrated = hydrateSiteContent(data);
      setContent(hydrated);
      savedBaselineRef.current = JSON.stringify(hydrated);
      void pushPreview(hydrated);
    } catch (error) {
      setContent(null);
      setLoadError(error instanceof Error ? error.message : 'Failed to load site content');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const page = searchParams.get('page');
    if (page && SITE_CONTENT_PAGES.includes(page as SiteContentPage)) {
      setActivePage(page as SiteContentPage);
    }
  }, [searchParams]);

  useEffect(() => {
    const section = searchParams.get('section');
    if (!section || loading || !content) return undefined;

    const elementId = cmsSectionElementId(activePage, section);
    const timer = window.setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element instanceof HTMLDetailsElement) {
        element.open = true;
      }
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [searchParams, activePage, loading, content]);

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

  useEffect(() => {
    if (!content) return undefined;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      void pushPreview(content);
    }, 300);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [content, pushPreview]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function requestTabChange(nextPage: SiteContentPage) {
    if (nextPage === activePage) return;
    if (isDirty && !window.confirm('You have unsaved changes on Site Pages. Switch tabs anyway? Your edits stay in this session until you save or leave admin.')) {
      return;
    }
    setActivePage(nextPage);
  }

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
          savedBaselineRef.current = JSON.stringify(next);
          return next;
        });
      } else if (content) {
        savedBaselineRef.current = JSON.stringify(content);
      }
      setMessage('Site content saved.');
      await fetch('/api/admin/site-content/preview', { method: 'DELETE', credentials: 'include' });
      if (content) void pushPreview(content);
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
            onClick={() => requestTabChange(tab.key)}
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
            <EditorSection title="Site appearance" defaultOpen id={cmsSectionElementId('identity', 'branding')}>
              <ThemeColorEditor
                primaryColor={content.identity.theme.primaryColor}
                accentColor={content.identity.theme.accentColor}
                onPrimaryChange={(value) => setContent({
                  ...content,
                  identity: { ...content.identity, theme: { ...content.identity.theme, primaryColor: value } },
                })}
                onAccentChange={(value) => setContent({
                  ...content,
                  identity: { ...content.identity, theme: { ...content.identity.theme, accentColor: value } },
                })}
                onApplyPalette={(primary, accent) => setContent({
                  ...content,
                  identity: {
                    ...content.identity,
                    theme: { ...content.identity.theme, primaryColor: primary, accentColor: accent },
                  },
                })}
                fontPreset={content.identity.theme.fontPreset}
                onFontPresetChange={(value) => setContent({
                  ...content,
                  identity: {
                    ...content.identity,
                    theme: { ...content.identity.theme, fontPreset: value },
                  },
                })}
                cardStyle={content.identity.theme.cardStyle ?? 'studio'}
                onCardStyleChange={(value) => setContent({
                  ...content,
                  identity: {
                    ...content.identity,
                    theme: { ...content.identity.theme, cardStyle: value },
                  },
                })}
                spacingDensity={content.identity.theme.spacingDensity ?? 'comfortable'}
                onSpacingDensityChange={(value) => setContent({
                  ...content,
                  identity: {
                    ...content.identity,
                    theme: { ...content.identity.theme, spacingDensity: value },
                  },
                })}
                siteDisplayName={headerDisplayName(content.identity)}
                navPreviewLabels={visibleNavItems(content.identity).map((item) => item.label)}
                paletteSourceImage={content.home.hero.portraitImage || content.bio.hero.portraitImage}
                canRevert={appearanceDirty}
                onRevert={revertAppearance}
              />
              <div className="mt-6 space-y-4 border-t border-gray-200 pt-6">
                <p className="text-sm font-medium text-gray-900">Page structure</p>
                <SelectField
                  label="Homepage layout"
                  value={content.home.layoutTemplate}
                  onChange={(value) => setContent({
                    ...content,
                    home: { ...content.home, layoutTemplate: value as typeof content.home.layoutTemplate },
                  })}
                  options={[
                    { value: 'classic', label: 'Classic — banner first, then blocks below' },
                    { value: 'gallery-first', label: 'Gallery first — artwork spotlight above the banner' },
                    { value: 'story-first', label: 'Story first — about preview above the banner' },
                  ]}
                  help="Changes which block visitors see first without hiding your banner."
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SelectField
                    label="Shop grid columns"
                    value={content.shop.layout.gridColumns}
                    onChange={(value) => setContent({
                      ...content,
                      shop: {
                        ...content.shop,
                        layout: { ...content.shop.layout, gridColumns: value as typeof content.shop.layout.gridColumns },
                      },
                    })}
                    options={[
                      { value: '2', label: '2 columns' },
                      { value: '3', label: '3 columns' },
                      { value: '4', label: '4 columns' },
                    ]}
                  />
                  <CheckboxField
                    label="Show shop filters"
                    checked={content.shop.layout.showFilters}
                    onChange={(value) => setContent({
                      ...content,
                      shop: {
                        ...content.shop,
                        layout: { ...content.shop.layout, showFilters: value },
                      },
                    })}
                  />
                  <SelectField
                    label="Portfolio grid columns"
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
                  <CheckboxField
                    label="Portfolio masonry layout"
                    checked={content.portfolio.layout.masonry}
                    onChange={(value) => setContent({
                      ...content,
                      portfolio: {
                        ...content.portfolio,
                        layout: { ...content.portfolio.layout, masonry: value },
                      },
                    })}
                    help="Taller portrait crops instead of uniform squares."
                  />
                  <CheckboxField
                    label="Show portfolio category filters"
                    checked={content.portfolio.layout.showFilters}
                    onChange={(value) => setContent({
                      ...content,
                      portfolio: {
                        ...content.portfolio,
                        layout: { ...content.portfolio.layout, showFilters: value },
                      },
                    })}
                  />
                </div>
              </div>
            </EditorSection>
            <EditorSection title="Footer columns" id={cmsSectionElementId('identity', 'footer')}>
              <TextField label="Quick links heading" value={content.identity.footer.quickLinksHeading} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, quickLinksHeading: value } } })} />
              <TextField label="Legal heading" value={content.identity.footer.legalHeading} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, legalHeading: value } } })} />
              <CheckboxField label="Show legal links" checked={content.identity.footer.showLegal} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, showLegal: value } } })} />
              <CheckboxField label="Show extra footer column" checked={content.identity.footer.extraColumn.show} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, extraColumn: { ...content.identity.footer.extraColumn, show: value } } } })} />
              <TextField label="Extra column heading" value={content.identity.footer.extraColumn.heading} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, extraColumn: { ...content.identity.footer.extraColumn, heading: value } } } })} help="For example: Studio hours, Visit us, or Press kit." />
              <HtmlField label="Extra column body" value={content.identity.footer.extraColumn.bodyHtml} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, extraColumn: { ...content.identity.footer.extraColumn, bodyHtml: value } } } })} />
            </EditorSection>
            <EditorSection title="Navigation" defaultOpen id={cmsSectionElementId('identity', 'navigation')}>
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
            <EditorSection title="Legal pages" id={cmsSectionElementId('identity', 'legal')}>
              <p className="text-sm text-gray-600">Privacy and terms pages linked from your footer.</p>
              <LegalPagesEditor />
            </EditorSection>
          </div>
        )}

        {activePage === 'home' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Homepage layout and colors are in Branding → Site appearance. Edit copy and sections here.</p>
            <EditorSection title="Homepage blocks" defaultOpen>
              <p className="text-sm text-gray-600">Choose which blocks appear on your homepage and in what order. The top banner always stays first. Hide individual blocks in their panels below.</p>
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
            <EditorSection title="Top of homepage" defaultOpen id={cmsSectionElementId('home', 'hero')}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Banner size"
                  value={content.home.hero.height}
                  onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, height: value as typeof content.home.hero.height } } })}
                  options={[
                    { value: 'compact', label: 'Compact — artwork appears sooner' },
                    { value: 'full', label: 'Tall — full screen banner' },
                  ]}
                />
                <div className="md:col-span-2">
                  <HeroImagePlacementPicker
                    value={content.home.hero.imagePlacement}
                    onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, imagePlacement: value as typeof content.home.hero.imagePlacement } } })}
                  />
                </div>
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
                  label="Show extra buttons below the main button"
                  checked={content.home.hero.showSecondaryCtas}
                  onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, showSecondaryCtas: value } } })}
                  help="Turn off to show only the main button."
                />
              </div>
            </EditorSection>
            <EditorSection title="Headline & welcome message" defaultOpen>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Title line 1" value={content.home.hero.titleLine1} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, titleLine1: value } } })} />
                <TextField label="Title line 2" value={content.home.hero.titleLine2} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, titleLine2: value } } })} />
                <div className="md:col-span-2"><TextAreaField label="Subtitle" value={content.home.hero.subtitle} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, subtitle: value } } })} /></div>
                <TextField label="Shop button" value={content.home.hero.ctaShop} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, ctaShop: value } } })} />
                <TextField label="Portfolio button" value={content.home.hero.ctaPortfolio} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, ctaPortfolio: value } } })} />
                <TextField label="Contact button" value={content.home.hero.ctaContact} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, ctaContact: value } } })} />
                <div className="md:col-span-2">
                  <MediaImageField label="Your photo" value={content.home.hero.portraitImage} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, portraitImage: value } } })} help="Upload an image or pick from your library. Leave blank to hide." />
                </div>
              </div>
            </EditorSection>
            <EditorSection title="Artwork spotlight" id={cmsSectionElementId('home', 'featured')}>
              <CheckboxField label="Show this section" checked={content.home.featured.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, featured: { ...content.home.featured, showSection: value } } })} />
              <SelectField
                label="Grid columns"
                value={content.home.featured.columns}
                onChange={(value) => setContent({
                  ...content,
                  home: {
                    ...content.home,
                    featured: { ...content.home.featured, columns: value as typeof content.home.featured.columns },
                  },
                })}
                options={[
                  { value: '2', label: '2 columns' },
                  { value: '3', label: '3 columns' },
                  { value: '4', label: '4 columns' },
                ]}
              />
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
              <TextField
                label="Empty section message"
                value={content.home.featured.emptyMessage}
                onChange={(value) => setContent({ ...content, home: { ...content.home, featured: { ...content.home.featured, emptyMessage: value } } })}
                help="Shown when no works match your selection."
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
            <EditorSection title="About preview" id={cmsSectionElementId('home', 'about')}>
              <CheckboxField label="Show this section" checked={content.home.about.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, showSection: value } } })} />
              <TextField label="Section title" value={content.home.about.title} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, title: value } } })} />
              <TextAreaField label="First paragraph" value={content.home.about.paragraph1} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, paragraph1: value } } })} />
              <TextAreaField label="Second paragraph" value={content.home.about.paragraph2} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, paragraph2: value } } })} />
              <TextField label="Call-to-action button" value={content.home.about.cta} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, cta: value } } })} />
              <MediaImageField label="Studio image" value={content.home.about.studioImage} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, studioImage: value } } })} help="Leave blank to hide the image." />
            </EditorSection>
            <EditorSection title="Updates preview" id={cmsSectionElementId('home', 'blog')}>
              <CheckboxField label="Show this section" checked={content.home.blog.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, showSection: value } } })} />
              <TextField label="Section title" value={content.home.blog.title} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, title: value } } })} />
              <TextAreaField label="Section description" value={content.home.blog.description} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, description: value } } })} />
              <TextField label="Empty section message" value={content.home.blog.emptyMessage} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, emptyMessage: value } } })} help="Shown when there are no public updates yet." />
              <TextField label="View-all link text" value={content.home.blog.cta} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, cta: value } } })} />
            </EditorSection>
            <EditorSection title="Newsletter" id={cmsSectionElementId('home', 'newsletter')}>
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
            <EditorSection title="Section order" defaultOpen>
              <p className="text-sm text-gray-600">Reorder biography blocks on the public page. Background and achievements stay side-by-side when they are next to each other.</p>
              <div className="space-y-3">
                {content.bio.sectionOrder.map((sectionKey, index) => (
                  <div key={sectionKey} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                    <span className="text-sm font-medium text-gray-900">{BIO_SECTION_LABELS[sectionKey]}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() => setContent({
                          ...content,
                          bio: { ...content.bio, sectionOrder: reorder(content.bio.sectionOrder, index, -1) },
                        })}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                        disabled={index === content.bio.sectionOrder.length - 1}
                        onClick={() => setContent({
                          ...content,
                          bio: { ...content.bio, sectionOrder: reorder(content.bio.sectionOrder, index, 1) },
                        })}
                      >
                        Down
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </EditorSection>
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
            <EditorSection title="Welcome area" defaultOpen id={cmsSectionElementId('bio', 'hero')}>
              <TextField label="Page title" value={content.bio.hero.title} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, title: value } } })} />
              <TextAreaField label="Intro text" value={content.bio.hero.subtitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, subtitle: value } } })} />
              <MediaImageField label="Your photo" value={content.bio.hero.portraitImage} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, portraitImage: value } } })} help="Leave blank to hide." />
              <TextField label="Portfolio button" value={content.bio.hero.ctaPortfolio} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, ctaPortfolio: value } } })} help="Leave blank to hide this button." />
              <TextField label="Contact button" value={content.bio.hero.ctaContact} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, ctaContact: value } } })} help="Leave blank to hide this button." />
            </EditorSection>
            <EditorSection title="Artist statement" id={cmsSectionElementId('bio', 'statement')}>
              <TextField label="Artist statement heading" value={content.bio.statementTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, statementTitle: value } })} />
              <HtmlField label="Artist statement" value={content.bio.artistStatementHtml} onChange={(value) => setContent({ ...content, bio: { ...content.bio, artistStatementHtml: value } })} />
            </EditorSection>
            <EditorSection title="Studio practice" id={cmsSectionElementId('bio', 'studio')}>
              <TextField label="Studio section heading" value={content.bio.studioTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioTitle: value } })} />
              <MediaImageField label="Studio image" value={content.bio.studioImage} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioImage: value } })} />
              <HtmlField label="Studio practice section" value={content.bio.studioPracticeHtml} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioPracticeHtml: value } })} />
            </EditorSection>
            <EditorSection title="Background and achievements" id={cmsSectionElementId('bio', 'background')}>
              <TextField label="Background heading" value={content.bio.backgroundTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, backgroundTitle: value } })} />
              <HtmlField label="Background section" value={content.bio.backgroundHtml} help="Education and professional experience." onChange={(value) => setContent({ ...content, bio: { ...content.bio, backgroundHtml: value } })} />
              <TextField label="Achievements heading" value={content.bio.achievementsTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, achievementsTitle: value } })} />
              <HtmlField label="Achievements section" value={content.bio.achievementsHtml} onChange={(value) => setContent({ ...content, bio: { ...content.bio, achievementsHtml: value } })} />
            </EditorSection>
            <EditorSection title="Collections and press" id={cmsSectionElementId('bio', 'collections')}>
              <TextField label="Collections heading" value={content.bio.collectionsTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, collectionsTitle: value } })} />
              <HtmlField label="Collections and press section" value={content.bio.collectionsHtml} onChange={(value) => setContent({ ...content, bio: { ...content.bio, collectionsHtml: value } })} />
            </EditorSection>
            <EditorSection title="Closing call to action" id={cmsSectionElementId('bio', 'cta')}>
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
            <EditorSection title="Contact page intro" defaultOpen id={cmsSectionElementId('contact', 'header')}>
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
            <EditorSection title="Inquiry types" id={cmsSectionElementId('contact', 'inquiry')}>
              <CommissionIntakeWizard
                contact={content.contact}
                onApply={(nextContact) => setContent({ ...content, contact: nextContact })}
              />
              <p className="text-sm text-gray-600">Fine-tune labels and order below. Hidden types stay valid if a previous form submission used them.</p>
              <OrderedListEditor
                items={content.contact.form.inquiryTypes}
                onChange={(inquiryTypes: ContactInquiryType[]) => setContent({
                  ...content,
                  contact: { ...content.contact, form: { ...content.contact.form, inquiryTypes } },
                })}
              />
            </EditorSection>
            <EditorSection title="Side panel" id={cmsSectionElementId('contact', 'sidebar')}>
              <TextField label="Side panel heading" value={content.contact.sidebar.connectTitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, connectTitle: value } } })} />
              <TextAreaField label="Side panel intro" value={content.contact.sidebar.connectText} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, connectText: value } } })} />
              <TextField label="Contact info heading" value={content.contact.sidebar.contactInfoTitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, contactInfoTitle: value } } })} />
              <TextField label="Location" value={content.contact.sidebar.location} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, location: value } } })} />
              <TextField label="Instagram handle" value={content.contact.sidebar.instagramHandle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, instagramHandle: value } } })} />
              <TextField label="Response time heading" value={content.contact.sidebar.responseTimeTitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, responseTimeTitle: value } } })} />
              <HtmlField label="Response time block" value={content.contact.sidebar.responseTimeHtml} help="Collapses on phones." onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, responseTimeHtml: value } } })} />
              <TextField label="Commission heading" value={content.contact.sidebar.commissionTitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, commissionTitle: value } } })} />
              <HtmlField label="Commission info block" value={content.contact.sidebar.commissionHtml} onChange={(value) => setContent({ ...content, contact: { ...content.contact, sidebar: { ...content.contact.sidebar, commissionHtml: value } } })} />
              <MediaImageField label="Portrait image" value={content.contact.portraitImage} onChange={(value) => setContent({ ...content, contact: { ...content.contact, portraitImage: value } })} />
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
            <SelectField
              label="Artwork page layout"
              value={content.portfolio.artworkDetailLayout}
              onChange={(value) => setContent({ ...content, portfolio: { ...content.portfolio, artworkDetailLayout: value as typeof content.portfolio.artworkDetailLayout } })}
              options={[
                { value: 'standard', label: 'Standard — gallery and details side by side' },
                { value: 'gallery-focus', label: 'Gallery focus — full-width image above details' },
              ]}
            />
            <p className="text-sm text-gray-600">Grid layout and filters are in Branding → Site appearance.</p>
          </div>
        )}

        {activePage === 'shop' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Shop grid layout is in Branding → Site appearance.</p>
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
            <EditorSection title="Checkout & confirmation" id={cmsSectionElementId('shop', 'checkout')}>
              <TextField label="Checkout page title" value={content.shop.checkoutPageTitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, checkoutPageTitle: value } })} />
              <TextField label="Checkout page subtitle" value={content.shop.checkoutPageSubtitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, checkoutPageSubtitle: value } })} />
              <TextField label="Step: Contact" value={content.shop.checkoutStepContact} onChange={(value) => setContent({ ...content, shop: { ...content.shop, checkoutStepContact: value } })} />
              <TextField label="Step: Shipping" value={content.shop.checkoutStepShipping} onChange={(value) => setContent({ ...content, shop: { ...content.shop, checkoutStepShipping: value } })} />
              <TextField label="Step: Review & pay" value={content.shop.checkoutStepReview} onChange={(value) => setContent({ ...content, shop: { ...content.shop, checkoutStepReview: value } })} />
              <TextAreaField label="Checkout trust copy" value={content.shop.checkoutTrustCopy} onChange={(value) => setContent({ ...content, shop: { ...content.shop, checkoutTrustCopy: value } })} help="Displayed below the pay button on checkout." />
              <TextField label="Success page title" value={content.shop.successTitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, successTitle: value } })} />
              <TextField label="Success page subtitle" value={content.shop.successSubtitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, successSubtitle: value } })} />
              <TextAreaField label="What happens next (HTML)" value={content.shop.successNextStepsHtml} onChange={(value) => setContent({ ...content, shop: { ...content.shop, successNextStepsHtml: value } })} help="Use a simple list for post-purchase steps." />
            </EditorSection>
            <SelectField
              label="Product page layout"
              value={content.shop.productDetailLayout}
              onChange={(value) => setContent({ ...content, shop: { ...content.shop, productDetailLayout: value as typeof content.shop.productDetailLayout } })}
              options={[
                { value: 'standard', label: 'Standard — gallery and details side by side' },
                { value: 'gallery-focus', label: 'Gallery focus — full-width image above details' },
              ]}
            />
            <EditorSection title="Purchase information" id={cmsSectionElementId('shop', 'purchase')}>
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
          <div className="space-y-4" id={cmsSectionElementId('blog', 'listing')}>
            <SelectField
              label="Listing header size"
              value={content.blog.hero.height}
              onChange={(value) => setContent({ ...content, blog: { ...content.blog, hero: { ...content.blog.hero, height: value as typeof content.blog.hero.height } } })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'full', label: 'Spacious' },
              ]}
            />
            <p className="text-sm text-gray-600">The header and footer link label is edited in Branding → Navigation (the Updates item). This page controls the feed itself.</p>
            <TextField label="Page title" value={content.blog.title} onChange={(value) => setContent({ ...content, blog: { ...content.blog, title: value } })} />
            <TextAreaField label="Page subtitle" value={content.blog.subtitle} onChange={(value) => setContent({ ...content, blog: { ...content.blog, subtitle: value } })} />
            <SelectField
              label="Feed layout"
              value={content.blog.feedLayout}
              onChange={(value) => setContent({ ...content, blog: { ...content.blog, feedLayout: value as typeof content.blog.feedLayout } })}
              options={[
                { value: 'timeline', label: 'Timeline (captions under media)' },
                { value: 'grid', label: 'Grid (studio wall)' },
              ]}
            />
            <CheckboxField label="Show journal / studio filters" checked={content.blog.showFormatFilters} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showFormatFilters: value } })} />
            <TextField label="Journal filter label" value={content.blog.journalLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, journalLabel: value } })} />
            <TextField label="Studio filter label" value={content.blog.studioLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, studioLabel: value } })} />
            <CheckboxField label="Show collector-only section" checked={content.blog.showPrivateSection} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showPrivateSection: value } })} help="Private updates appear only to signed-in emails you whitelist on the post." />
            <TextField label="Collector section title" value={content.blog.privateSectionTitle} onChange={(value) => setContent({ ...content, blog: { ...content.blog, privateSectionTitle: value } })} />
            <TextAreaField label="Collector section description" value={content.blog.privateSectionSubtitle} onChange={(value) => setContent({ ...content, blog: { ...content.blog, privateSectionSubtitle: value } })} />
            <TextField label="Sign-in button" value={content.blog.privateSignInLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, privateSignInLabel: value } })} />
            <TextField label="Quick look button" value={content.blog.quickLookLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, quickLookLabel: value } })} />
            <TextField label="Save update button" value={content.blog.saveUpdateLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, saveUpdateLabel: value } })} />
            <TextField label="Ask artist button" value={content.blog.askArtistLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, askArtistLabel: value } })} />
            <TextField label="Featured badge label" value={content.blog.featuredLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, featuredLabel: value } })} />
            <TextField label="Public tab label" value={content.blog.publicTabLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, publicTabLabel: value } })} />
            <TextField label="All filter label" value={content.blog.allFilterLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, allFilterLabel: value } })} />
            <CheckboxField label="Show publish date on timeline posts" checked={content.blog.showFeedDate} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showFeedDate: value } })} />
            <CheckboxField label="Show author on timeline posts" checked={content.blog.showFeedAuthor} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showFeedAuthor: value } })} />
            <CheckboxField label="Show tags on timeline posts" checked={content.blog.showFeedTags} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showFeedTags: value } })} />
            <CheckboxField label="Show comments on updates" checked={content.blog.showComments} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showComments: value } })} />
            <CheckboxField label="Show likes on updates" checked={content.blog.showLikes} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showLikes: value } })} />
            <TextField label="Comments section label" value={content.blog.commentsLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, commentsLabel: value } })} />
            <TextField label="Like button label" value={content.blog.likeLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, likeLabel: value } })} />
            <SelectField
              label="Auto-create private update when order enters processing"
              value={content.blog.autoOrderProgressPost}
              onChange={(value) => setContent({ ...content, blog: { ...content.blog, autoOrderProgressPost: value as typeof content.blog.autoOrderProgressPost } })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'draft', label: 'Create as draft for review' },
                { value: 'publish', label: 'Publish and notify collector' },
              ]}
            />
            <TextAreaField label="Order progress update template" value={content.blog.autoOrderProgressExcerpt} onChange={(value) => setContent({ ...content, blog: { ...content.blog, autoOrderProgressExcerpt: value } })} help="Use {{summary}} and {{orderNumber}} placeholders." />
            <CheckboxField label="Send public updates digest email" checked={content.blog.digestEnabled} onChange={(value) => setContent({ ...content, blog: { ...content.blog, digestEnabled: value } })} />
            <TextField label="Digest interval (days)" value={String(content.blog.digestIntervalDays)} onChange={(value) => {
              const parsed = Number.parseInt(value, 10);
              if (!Number.isFinite(parsed)) return;
              setContent({ ...content, blog: { ...content.blog, digestIntervalDays: Math.min(30, Math.max(1, parsed)) } });
            }} />
            <TextField label="Digest email subject" value={content.blog.digestSubject} onChange={(value) => setContent({ ...content, blog: { ...content.blog, digestSubject: value } })} />
            <TextAreaField label="Digest email intro" value={content.blog.digestIntro} onChange={(value) => setContent({ ...content, blog: { ...content.blog, digestIntro: value } })} />
            <CheckboxField label="Send collector private-updates digest" checked={content.blog.collectorDigestEnabled} onChange={(value) => setContent({ ...content, blog: { ...content.blog, collectorDigestEnabled: value } })} />
            <TextField label="Collector digest subject" value={content.blog.collectorDigestSubject} onChange={(value) => setContent({ ...content, blog: { ...content.blog, collectorDigestSubject: value } })} />
            <TextAreaField label="Collector digest intro" value={content.blog.collectorDigestIntro} onChange={(value) => setContent({ ...content, blog: { ...content.blog, collectorDigestIntro: value } })} />
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
            <p className="text-xs text-gray-500">Updates as you edit — save to publish changes.</p>
          </div>
          <div className="flex items-center gap-3">
            {isDirty && <span className="text-xs font-medium text-amber-700">Unsaved changes</span>}
            <a href={`${previewHref}?cmsPreview=1&preview=${previewToken}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:opacity-80">
              Open full page
            </a>
          </div>
        </div>
        <iframe
          key={`${activePage}-${previewToken}`}
          title={`Preview ${activeTab.label}`}
          src={`${previewHref}?cmsPreview=1&preview=${previewToken}`}
          className="w-full h-[720px] bg-white"
        />
      </div>
    </div>
  );
}
