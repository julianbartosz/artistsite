'use client';

import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckboxField, EditorSection, HtmlField, ReorderButtons, SelectField, TextAreaField, TextField, reorder } from '@/components/admin/EditorFields';
import { IntegerField } from '@/components/admin/StudioFormFields';
import SiteAppearancePanel from '@/components/admin/SiteAppearancePanel';
import MediaImageField from '@/components/admin/MediaImageField';
import BioNarrativeWizard from '@/components/admin/BioNarrativeWizard';
import CommissionIntakeWizard from '@/components/admin/CommissionIntakeWizard';
import PortfolioPresentationWizard from '@/components/admin/PortfolioPresentationWizard';
import { useUnsavedChangesGuard } from '@/components/admin/useUnsavedChangesGuard';
import { cmsSectionElementId } from '@/lib/cms-edit-map';
import { PRODUCT_IMAGE_FALLBACK } from '@/lib/commerce';
import type {
  ContactInquiryType,
  NavItem,
  PortfolioCategory,
  SiteContentByPage,
  SiteContentPage,
  BioSectionKey,
} from '@/lib/site-content-shared';
import {
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
  PAGE_SCHEMAS,
  PORTFOLIO_CATEGORY_STARTERS,
  SITE_CONTENT_DEFAULTS,
  SITE_CONTENT_PAGES,
  SITE_CONTENT_PREVIEW_HREF,
  mergePortfolioCategoriesFromTags,
  normalizePortfolioCategoryKey,
  type HomeSectionKey,
} from '@/lib/site-content-shared';

const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  featured: 'Artwork spotlight',
  about: 'About preview',
  blog: 'Updates preview',
  newsletter: 'Newsletter',
};

function homeSectionIsVisible(home: SiteContentByPage['home'], sectionKey: HomeSectionKey): boolean {
  if (sectionKey === 'featured') return home.featured.showSection;
  if (sectionKey === 'about') return home.about.showSection;
  if (sectionKey === 'blog') return home.blog.showSection;
  return home.newsletter.showSection;
}

const BIO_SECTION_LABELS: Record<BioSectionKey, string> = {
  statement: 'Artist statement',
  background: 'Your path (optional)',
  achievements: 'Shows & recognition (optional)',
  studio: 'How you work',
  collections: 'Collections & press (optional)',
  cta: 'Closing call to action',
};

function bioSectionIsVisible(bio: SiteContentByPage['bio'], sectionKey: BioSectionKey): boolean {
  if (sectionKey === 'statement') return bio.showStatement;
  if (sectionKey === 'background') return bio.showBackground;
  if (sectionKey === 'achievements') return bio.showAchievements;
  if (sectionKey === 'studio') return bio.showStudio;
  if (sectionKey === 'collections') return bio.showCollections;
  return bio.showCta;
}

const NAV_PAGE_LABELS: Record<string, string> = {
  home: 'Home page',
  portfolio: 'Portfolio',
  shop: 'Shop',
  blog: 'Updates',
  bio: 'Bio',
  contact: 'Contact',
};

type ArtworkOption = { slug: string; title: string; featured: boolean; category: string[]; image: string };

function artworkImage(images: unknown): string {
  if (!images || typeof images !== 'object') return '';
  const { thumbnail, main } = images as { thumbnail?: unknown; main?: unknown };
  if (typeof thumbnail === 'string' && thumbnail.trim()) return thumbnail;
  return typeof main === 'string' ? main : '';
}

function samePageContent<P extends SiteContentPage>(left: SiteContentByPage[P], right: SiteContentByPage[P]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

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
      try {
        assignPage(next, page, PAGE_SCHEMAS[page].parse(incoming) as SiteContentByPage[typeof page]);
      } catch {
        // Keep defaults when a page payload fails validation.
      }
    }
  }
  return next;
}

const PAGE_TABS: Array<{ key: SiteContentPage; label: string; description: string }> = [
  { key: 'identity', label: 'Branding', description: 'Name, logo, site appearance, navigation, and footer.' },
  { key: 'home', label: 'Home', description: 'Homepage layout, top banner, blocks, artwork spotlight, about, updates preview, and newsletter.' },
  { key: 'bio', label: 'Bio', description: 'How you present yourself — narrative structure, statement, optional CV sections, and portraits.' },
  { key: 'contact', label: 'Contact', description: 'Form labels, inquiry types, sidebar copy, and response details.' },
  { key: 'portfolio', label: 'Portfolio', description: 'Grid layout, image framing, categories, and listing copy.' },
  { key: 'shop', label: 'Shop', description: 'Grid and filters, shop copy, search placeholder, and purchase-information blocks.' },
  { key: 'blog', label: 'Updates', description: 'Public feed, studio/journal filters, collector-only section, and subscribe links.' },
];

function BoundedIntField({
  label,
  value,
  min,
  max,
  help,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  help?: string;
  onChange: (value: number) => void;
}) {
  return (
    <IntegerField
      label={label}
      value={value}
      min={min}
      max={max}
      help={help}
      onChange={(next) => {
        if (typeof next === 'number') onChange(next);
      }}
    />
  );
}

function HeroImagePlacementPicker({
  value,
  hasPhoto,
  onChange,
}: {
  value: string;
  hasPhoto: boolean;
  onChange: (value: string) => void;
}) {
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
      {!hasPhoto && (
        <p className="mt-1.5 text-xs text-gray-500">Add a photo below to see this placement on your homepage.</p>
      )}
    </fieldset>
  );
}

function LegalPagesEditor({
  privacyHtml,
  termsHtml,
  loading,
  error,
  onChangePrivacy,
  onChangeTerms,
}: {
  privacyHtml: string;
  termsHtml: string;
  loading: boolean;
  error: string | null;
  onChangePrivacy: (html: string) => void;
  onChangeTerms: (html: string) => void;
}) {
  if (loading) {
    return <p className="text-sm text-gray-500">Loading legal pages…</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <div className="space-y-2">
        <HtmlField
          label="Privacy policy"
          value={privacyHtml}
          onChange={onChangePrivacy}
          help="Shown at /privacy. Leave blank to keep the built-in studio policy."
        />
        {!privacyHtml.trim() && (
          <button
            type="button"
            onClick={() => onChangePrivacy(DEFAULT_PRIVACY_HTML)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Load default privacy policy to customize
          </button>
        )}
      </div>
      <div className="space-y-2">
        <HtmlField
          label="Terms of service"
          value={termsHtml}
          onChange={onChangeTerms}
          help="Shown at /terms. Leave blank to keep the built-in studio terms."
        />
        {!termsHtml.trim() && (
          <button
            type="button"
            onClick={() => onChangeTerms(DEFAULT_TERMS_HTML)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Load default terms of service to customize
          </button>
        )}
      </div>
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
              <ReorderButtons name={NAV_PAGE_LABELS[item.key] || item.key} index={index} count={items.length} onMove={(direction) => onChange(reorder(items, index, direction))} />
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

function PortfolioCategoryEditor({
  items,
  onChange,
  artworkTags,
}: {
  items: PortfolioCategory[];
  onChange: (items: PortfolioCategory[]) => void;
  artworkTags: string[];
}) {
  const [draftLabel, setDraftLabel] = useState('');

  function addCategory(labelInput: string) {
    const label = labelInput.trim();
    if (!label) return;
    const key = normalizePortfolioCategoryKey(label);
    if (items.some((item) => normalizePortfolioCategoryKey(item.key) === key)) {
      setDraftLabel('');
      return;
    }
    onChange([...items, { key, label, visible: true }]);
    setDraftLabel('');
  }

  const unusedStarters = PORTFOLIO_CATEGORY_STARTERS.filter(
    (starter) => !items.some((item) => normalizePortfolioCategoryKey(item.key) === normalizePortfolioCategoryKey(starter)),
  );
  const importableCount = mergePortfolioCategoriesFromTags(items, artworkTags).length - items.length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Choose the filters visitors see. Match these names when tagging artworks — spelling can vary; we normalize them.
      </p>
      {items.length === 0 && (
        <p className="text-sm text-gray-500">
          No categories yet. Add a few below, or import tags already on your artworks.
        </p>
      )}
      {unusedStarters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unusedStarters.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => addCategory(starter)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              + {starter}
            </button>
          ))}
        </div>
      )}
      {artworkTags.length > 0 && (
        <button
          type="button"
          onClick={() => onChange(mergePortfolioCategoriesFromTags(items, artworkTags))}
          disabled={importableCount <= 0}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importableCount > 0
            ? `Add ${importableCount} tag${importableCount === 1 ? '' : 's'} from your artworks`
            : 'All artwork tags already listed'}
        </button>
      )}
      {items.map((item, index) => (
        <div key={item.key} className="rounded-md border border-gray-200 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900">{item.label}</p>
            <div className="flex gap-2">
              <ReorderButtons name={item.label || 'category'} index={index} count={items.length} onMove={(direction) => onChange(reorder(items, index, direction))} />
              <button
                type="button"
                className="inline-flex min-h-9 items-center rounded border border-red-200 px-3 text-xs text-red-700 hover:bg-red-50"
                onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}
              >
                Remove
              </button>
            </div>
          </div>
          <TextField
            label="Display label"
            value={item.label}
            onChange={(label) => onChange(items.map((current, currentIndex) => (
              currentIndex === index ? { ...current, label } : current
            )))}
          />
          <CheckboxField
            label="Show in filters"
            checked={item.visible}
            onChange={(visible) => onChange(items.map((current, currentIndex) => (
              currentIndex === index ? { ...current, visible } : current
            )))}
          />
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <TextField
            label="Add category"
            value={draftLabel}
            onChange={setDraftLabel}
            help="Example: Paintings, Works on paper, Commissions"
          />
        </div>
        <button
          type="button"
          onClick={() => addCategory(draftLabel)}
          disabled={!draftLabel.trim()}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>
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
  const [previewOpen, setPreviewOpen] = useState(true);
  const [saved, setSaved] = useState<SiteContentByPage | null>(null);
  const [legalPages, setLegalPages] = useState({ privacyHtml: '', termsHtml: '' });
  const [savedLegalPages, setSavedLegalPages] = useState({ privacyHtml: '', termsHtml: '' });
  const [legalLoading, setLegalLoading] = useState(true);
  const [legalLoadError, setLegalLoadError] = useState<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPreviewDraftRef = useRef(false);

  const selectPageTab = useCallback((page: SiteContentPage, section?: string) => {
    setActivePage(page);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'pages');
    params.set('page', page);
    if (section) {
      params.set('section', section);
    } else {
      params.delete('section');
    }
    const nextUrl = `/admin?${params.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(min-width: 1280px)');
    const sync = () => setPreviewOpen(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const legalDirty = legalPages.privacyHtml !== savedLegalPages.privacyHtml
    || legalPages.termsHtml !== savedLegalPages.termsHtml;
  const dirtyContentPages = content && saved
    ? SITE_CONTENT_PAGES.filter((page) => !samePageContent(content[page], saved[page]))
    : [];
  const dirtyPages: SiteContentPage[] = legalDirty && !dirtyContentPages.includes('identity')
    ? ['identity', ...dirtyContentPages]
    : dirtyContentPages;
  const isDirty = dirtyPages.length > 0;

  const pushPreview = useCallback(async (snapshot: SiteContentByPage) => {
    try {
      const response = await fetch('/api/admin/site-content/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(snapshot),
      });
      if (response.ok) {
        hasPreviewDraftRef.current = true;
      }
      setPreviewToken((current) => current + 1);
    } catch {
      // Preview failures should not block editing.
    }
  }, []);

  const clearPreview = useCallback(async () => {
    try {
      await fetch('/api/admin/site-content/preview', {
        method: 'DELETE',
        credentials: 'include',
      });
      hasPreviewDraftRef.current = false;
      setPreviewToken((current) => current + 1);
    } catch {
      // Preview cleanup failures should not block editing.
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
      setSaved(hydrated);
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
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        const records = Object.fromEntries((data.settings || []).map((item: { key: string; value?: string }) => [item.key, item.value || '']));
        const loaded = {
          privacyHtml: records.LEGAL_PRIVACY_HTML || '',
          termsHtml: records.LEGAL_TERMS_HTML || '',
        };
        setLegalPages(loaded);
        setSavedLegalPages(loaded);
      })
      .catch(() => setLegalLoadError('Could not load legal pages.'))
      .finally(() => setLegalLoading(false));
    fetch('/api/admin/artworks', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.artworks)) {
          setArtworkOptions(
            data.artworks.map((artwork: {
              slug: string;
              title: string;
              featured: boolean;
              category?: unknown;
              images?: unknown;
            }) => {
              const rawCategory = artwork.category;
              let category: string[] = [];
              if (Array.isArray(rawCategory)) {
                category = rawCategory.filter((entry): entry is string => typeof entry === 'string');
              } else if (typeof rawCategory === 'string' && rawCategory.trim()) {
                category = rawCategory.split(',').map((part: string) => part.trim()).filter(Boolean);
              }
              return {
                slug: artwork.slug,
                title: artwork.title,
                featured: artwork.featured,
                category,
                image: artworkImage(artwork.images),
              };
            }),
          );
        }
      })
      .catch(() => undefined);
  }, []);

  const hasDirtyContent = dirtyContentPages.length > 0;
  useEffect(() => {
    if (!content) return undefined;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    if (hasDirtyContent) {
      previewTimerRef.current = setTimeout(() => {
        void pushPreview(content);
      }, 300);
    } else if (hasPreviewDraftRef.current) {
      previewTimerRef.current = setTimeout(() => {
        void clearPreview();
      }, 300);
    }
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [content, hasDirtyContent, pushPreview, clearPreview]);

  useUnsavedChangesGuard(isDirty);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!content || !saved || !isDirty) return;

    const submitted = Object.fromEntries(dirtyContentPages.map((page) => [page, content[page]])) as Partial<SiteContentByPage>;
    const submittedLegal = legalDirty ? { ...legalPages } : null;
    setSaving(true);
    setMessage(null);
    try {
      let stored: Partial<SiteContentByPage> = submitted;
      if (dirtyContentPages.length > 0) {
        const response = await fetch('/api/admin/site-content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pages: submitted }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save site content');
        stored = (data.pages ?? submitted) as Partial<SiteContentByPage>;
      }
      if (submittedLegal) {
        const legalResponse = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: {
              LEGAL_PRIVACY_HTML: submittedLegal.privacyHtml,
              LEGAL_TERMS_HTML: submittedLegal.termsHtml,
            },
          }),
        });
        const legalData = await legalResponse.json().catch(() => ({}));
        if (!legalResponse.ok) throw new Error(legalData.error || 'Failed to save legal pages');
        setSavedLegalPages(submittedLegal);
      }
      if (dirtyContentPages.length > 0) {
        const nextSaved = { ...saved };
        for (const page of dirtyContentPages) {
          if (stored[page]) assignPage(nextSaved, page, stored[page] as SiteContentByPage[typeof page]);
        }
        setSaved(nextSaved);
        // Keep edits made while the request was in flight; only pages unchanged since submit adopt the stored copy.
        setContent((current) => {
          if (!current) return current;
          const next = { ...current };
          for (const page of dirtyContentPages) {
            if (samePageContent(current[page], submitted[page] as SiteContentByPage[typeof page])) {
              assignPage(next, page, nextSaved[page]);
            }
          }
          return next;
        });
      }
      setMessage(dirtyPages.length === 1 ? 'Saved and published.' : `Saved and published ${dirtyPages.length} pages.`);
      await clearPreview();
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
    <div className="space-y-5" data-testid="site-content-editor">
      <div className="flex flex-wrap gap-2">
        {PAGE_TABS.map((tab) => {
          const tabDirty = dirtyPages.includes(tab.key);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => selectPageTab(tab.key)}
              aria-current={activePage === tab.key ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${activePage === tab.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {tab.label}
              {tabDirty && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                  <span className="sr-only">(unsaved changes)</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
      <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{activeTab.label}</h2>
            <p className="mt-1 text-sm text-gray-600">{activeTab.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View live ↗
            </a>
          </div>
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
              <TextField
                label="Tagline"
                value={content.identity.tagline}
                onChange={(value) => setContent({ ...content, identity: { ...content.identity, tagline: value } })}
                help="Shown in the footer and search previews."
              />
              <div className="md:col-span-2">
                <TextField label="Footer note" value={content.identity.footerTagline} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footerTagline: value } })} />
              </div>
              <div className="md:col-span-2">
                <MediaImageField
                  label="Logo (optional)"
                  value={content.identity.logoImage}
                  onChange={(value) => setContent({ ...content, identity: { ...content.identity, logoImage: value } })}
                  help="A signature or wordmark shown in place of your name in the header. A transparent PNG or WebP works best. Your browser tab icon is made from your initials and main color."
                />
              </div>
            </div>
            <EditorSection title="Site appearance" defaultOpen id={cmsSectionElementId('identity', 'branding')}>
              <SiteAppearancePanel
                theme={content.identity.theme}
                savedTheme={saved?.identity.theme ?? content.identity.theme}
                onChange={(theme) => setContent({ ...content, identity: { ...content.identity, theme } })}
                artworkChoices={artworkOptions
                  .filter((artwork) => artwork.image && artwork.image !== PRODUCT_IMAGE_FALLBACK)
                  .map((artwork) => ({ url: artwork.image, label: artwork.title }))}
              />
            </EditorSection>
            <EditorSection title="Footer columns" id={cmsSectionElementId('identity', 'footer')}>
              <TextField label="Quick links heading" value={content.identity.footer.quickLinksHeading} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, quickLinksHeading: value } } })} />
              <TextField label="Legal heading" value={content.identity.footer.legalHeading} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, legalHeading: value } } })} />
              <CheckboxField label="Show legal links" checked={content.identity.footer.showLegal} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, showLegal: value } } })} />
              <CheckboxField label="Show extra footer column" checked={content.identity.footer.extraColumn.show} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, extraColumn: { ...content.identity.footer.extraColumn, show: value } } } })} />
              {content.identity.footer.extraColumn.show && (
                <>
                  <TextField label="Extra column heading" value={content.identity.footer.extraColumn.heading} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, extraColumn: { ...content.identity.footer.extraColumn, heading: value } } } })} help="For example: Studio hours, Visit us, or Press kit." />
                  <HtmlField label="Extra column body" value={content.identity.footer.extraColumn.bodyHtml} onChange={(value) => setContent({ ...content, identity: { ...content.identity, footer: { ...content.identity.footer, extraColumn: { ...content.identity.footer.extraColumn, bodyHtml: value } } } })} />
                </>
              )}
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
              <p className="text-sm text-gray-600">Privacy and terms pages linked from your footer. Saved together with Branding changes.</p>
              <LegalPagesEditor
                privacyHtml={legalPages.privacyHtml}
                termsHtml={legalPages.termsHtml}
                loading={legalLoading}
                error={legalLoadError}
                onChangePrivacy={(privacyHtml) => setLegalPages((prev) => ({ ...prev, privacyHtml }))}
                onChangeTerms={(termsHtml) => setLegalPages((prev) => ({ ...prev, termsHtml }))}
              />
            </EditorSection>
          </div>
        )}

        {activePage === 'home' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Colors, type, and shape are in{' '}
              <button
                type="button"
                onClick={() => selectPageTab('identity', 'branding')}
                className="font-medium text-primary hover:underline"
              >
                Branding → Site appearance
              </button>
              .
            </p>
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
                {content.home.hero.imagePlacement === 'background' && content.home.hero.portraitImage.trim() && (
                  <SelectField
                    label="Photo focus"
                    value={content.home.hero.imageFocus ?? 'upper'}
                    onChange={(value) => setContent({
                      ...content,
                      home: { ...content.home, hero: { ...content.home.hero, imageFocus: value as typeof content.home.hero.imageFocus } },
                    })}
                    options={[
                      { value: 'top', label: 'Top of photo' },
                      { value: 'upper', label: 'Upper (portraits)' },
                      { value: 'center', label: 'Center' },
                      { value: 'bottom', label: 'Bottom of photo' },
                    ]}
                    help="Shifts which part of your background photo stays centered behind the headline."
                  />
                )}
                <div className="md:col-span-2">
                  <HeroImagePlacementPicker
                    value={content.home.hero.imagePlacement}
                    hasPhoto={Boolean(content.home.hero.portraitImage.trim())}
                    onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, imagePlacement: value as typeof content.home.hero.imagePlacement } } })}
                  />
                </div>
                <div className="md:col-span-2">
                  <MediaImageField label="Your photo" value={content.home.hero.portraitImage} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, portraitImage: value } } })} help="Upload an image or pick from your library. Leave blank to hide." />
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
                {(content.home.hero.showSecondaryCtas || content.home.hero.primaryCta === 'shop') && (
                  <TextField label="Shop button" value={content.home.hero.ctaShop} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, ctaShop: value } } })} />
                )}
                {(content.home.hero.showSecondaryCtas || content.home.hero.primaryCta === 'portfolio') && (
                  <TextField label="Portfolio button" value={content.home.hero.ctaPortfolio} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, ctaPortfolio: value } } })} />
                )}
                {(content.home.hero.showSecondaryCtas || content.home.hero.primaryCta === 'contact') && (
                  <TextField label="Contact button" value={content.home.hero.ctaContact} onChange={(value) => setContent({ ...content, home: { ...content.home, hero: { ...content.home.hero, ctaContact: value } } })} />
                )}
              </div>
            </EditorSection>
            <EditorSection title="Homepage blocks" defaultOpen>
              <p className="text-sm text-gray-600">Toggle blocks on or off and set their order. Edit each block’s copy in its panel below.</p>
              <div className="space-y-2.5">
                {content.home.sectionOrder.map((sectionKey, index) => {
                  const visible = homeSectionIsVisible(content.home, sectionKey);
                  const setVisible = (checked: boolean) => {
                    if (sectionKey === 'featured') {
                      setContent({ ...content, home: { ...content.home, featured: { ...content.home.featured, showSection: checked } } });
                    } else if (sectionKey === 'about') {
                      setContent({ ...content, home: { ...content.home, about: { ...content.home.about, showSection: checked } } });
                    } else if (sectionKey === 'blog') {
                      setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, showSection: checked } } });
                    } else {
                      setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, showSection: checked } } });
                    }
                  };
                  return (
                    <div key={sectionKey} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2.5">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm font-medium text-gray-900">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(event) => setVisible(event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className={visible ? 'text-gray-900' : 'text-gray-500'}>{HOME_SECTION_LABELS[sectionKey]}</span>
                        {!visible && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">Hidden</span>
                        )}
                      </label>
                      <div className="flex gap-2">
                        <ReorderButtons
                          name={HOME_SECTION_LABELS[sectionKey]}
                          index={index}
                          count={content.home.sectionOrder.length}
                          onMove={(direction) => setContent({
                            ...content,
                            home: { ...content.home, sectionOrder: reorder(content.home.sectionOrder, index, direction) },
                          })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </EditorSection>
            <EditorSection title="Artwork spotlight" id={cmsSectionElementId('home', 'featured')}>
              <CheckboxField label="Show this section" checked={content.home.featured.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, featured: { ...content.home.featured, showSection: value } } })} />
              {content.home.featured.showSection && (
                <>
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
                  <BoundedIntField
                    label="Number of works"
                    value={content.home.featured.limit}
                    min={1}
                    max={12}
                    onChange={(limit) => setContent({
                      ...content,
                      home: { ...content.home, featured: { ...content.home.featured, limit } },
                    })}
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
                </>
              )}
            </EditorSection>
            <EditorSection title="About preview" id={cmsSectionElementId('home', 'about')}>
              <CheckboxField label="Show this section" checked={content.home.about.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, showSection: value } } })} />
              {content.home.about.showSection && (
                <>
                  <TextField label="Section title" value={content.home.about.title} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, title: value } } })} />
                  <TextAreaField
                    label="About text"
                    value={[content.home.about.paragraph1, content.home.about.paragraph2].filter((block) => block.trim()).join('\n\n')}
                    help="Write one or more paragraphs about yourself. Leave a blank line between paragraphs."
                    onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, paragraph1: value, paragraph2: '' } } })}
                  />
                  <TextField label="Call-to-action button" value={content.home.about.cta} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, cta: value } } })} help="Leave blank to hide this button." />
                  <MediaImageField label="Studio image" value={content.home.about.studioImage} onChange={(value) => setContent({ ...content, home: { ...content.home, about: { ...content.home.about, studioImage: value } } })} help="Leave blank to hide the image." />
                </>
              )}
            </EditorSection>
            <EditorSection title="Updates preview" id={cmsSectionElementId('home', 'blog')}>
              <CheckboxField label="Show this section" checked={content.home.blog.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, showSection: value } } })} />
              {content.home.blog.showSection && (
                <>
                  <TextField label="Section title" value={content.home.blog.title} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, title: value } } })} />
                  <TextAreaField label="Section description" value={content.home.blog.description} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, description: value } } })} />
                  <TextField label="View-all link text" value={content.home.blog.cta} onChange={(value) => setContent({ ...content, home: { ...content.home, blog: { ...content.home.blog, cta: value } } })} />
                </>
              )}
            </EditorSection>
            <EditorSection title="Newsletter" id={cmsSectionElementId('home', 'newsletter')}>
              <CheckboxField label="Show this section" checked={content.home.newsletter.showSection} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, showSection: value } } })} />
              {content.home.newsletter.showSection && (
                <>
                  <TextField label="Section title" value={content.home.newsletter.title} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, title: value } } })} />
                  <TextAreaField label="Section description" value={content.home.newsletter.description} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, description: value } } })} />
                  <TextField label="Email placeholder" value={content.home.newsletter.placeholder} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, placeholder: value } } })} />
                  <TextField label="Subscribe button" value={content.home.newsletter.buttonLabel} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, buttonLabel: value } } })} />
                  <TextField label="Disclaimer" value={content.home.newsletter.disclaimer} onChange={(value) => setContent({ ...content, home: { ...content.home, newsletter: { ...content.home.newsletter, disclaimer: value } } })} />
                </>
              )}
            </EditorSection>
          </div>
        )}

        {activePage === 'bio' && (
          <div className="space-y-4">
            <BioNarrativeWizard
              bio={content.bio}
              onApply={(nextBio) => setContent({ ...content, bio: nextBio })}
            />
            <EditorSection title="Bio & artist statement" defaultOpen id={cmsSectionElementId('bio', 'hero')}>
              <TextField label="Page title" value={content.bio.hero.title} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, title: value } } })} />
              <TextAreaField label="Intro bio" value={content.bio.hero.subtitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, subtitle: value } } })} help="Shown under the title on your public bio. Leave a blank line between paragraphs." />
              <MediaImageField label="Your photo" value={content.bio.hero.portraitImage} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, portraitImage: value } } })} help="Leave blank for a clean centered layout." />
              {content.bio.hero.portraitImage.trim() && (
                <TextField label="Photo description" value={content.bio.hero.portraitImageAlt} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, portraitImageAlt: value } } })} help="Short alt text for accessibility. Leave blank for a generic label." />
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Portfolio button" value={content.bio.hero.ctaPortfolio} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, ctaPortfolio: value } } })} help="Leave blank to hide this button." />
                <TextField label="Contact button" value={content.bio.hero.ctaContact} onChange={(value) => setContent({ ...content, bio: { ...content.bio, hero: { ...content.bio.hero, ctaContact: value } } })} help="Leave blank to hide this button." />
              </div>
              {content.bio.showStatement && (
                <div id={cmsSectionElementId('bio', 'statement')} className="space-y-4 border-t border-gray-100 pt-4">
                  <TextField label="Artist statement heading (optional)" value={content.bio.statementTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, statementTitle: value } })} help="Leave blank to flow straight into the text without a separate heading." />
                  <HtmlField label="Artist statement (formatted)" value={content.bio.artistStatementHtml} help="Formatted paragraphs about what you make and why. Use the alignment buttons to center headings or text. Stays hidden until you write something." onChange={(value) => setContent({ ...content, bio: { ...content.bio, artistStatementHtml: value } })} />
                </div>
              )}
            </EditorSection>
            <EditorSection title="Page sections & order" defaultOpen>
              <p className="text-sm text-gray-600">
                Turn off anything that does not fit your story and reorder what stays visible. Empty CV blocks never appear on the public page.
              </p>
              <div className="space-y-2.5">
                {content.bio.sectionOrder.map((sectionKey, index) => {
                  const visible = bioSectionIsVisible(content.bio, sectionKey);
                  const toggleSection = (checked: boolean) => {
                    if (sectionKey === 'statement') setContent({ ...content, bio: { ...content.bio, showStatement: checked } });
                    else if (sectionKey === 'background') setContent({ ...content, bio: { ...content.bio, showBackground: checked } });
                    else if (sectionKey === 'achievements') setContent({ ...content, bio: { ...content.bio, showAchievements: checked } });
                    else if (sectionKey === 'studio') setContent({ ...content, bio: { ...content.bio, showStudio: checked } });
                    else if (sectionKey === 'collections') setContent({ ...content, bio: { ...content.bio, showCollections: checked } });
                    else setContent({ ...content, bio: { ...content.bio, showCta: checked } });
                  };
                  return (
                    <div key={sectionKey} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2.5">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm font-medium text-gray-900">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(event) => toggleSection(event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className={visible ? 'text-gray-900' : 'text-gray-500'}>{BIO_SECTION_LABELS[sectionKey]}</span>
                        {!visible && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">Hidden</span>
                        )}
                      </label>
                      <div className="flex gap-2">
                        <ReorderButtons
                          name={BIO_SECTION_LABELS[sectionKey]}
                          index={index}
                          count={content.bio.sectionOrder.length}
                          onMove={(direction) => setContent({
                            ...content,
                            bio: { ...content.bio, sectionOrder: reorder(content.bio.sectionOrder, index, direction) },
                          })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </EditorSection>
            {content.bio.showStudio && (
              <EditorSection title="How you work" id={cmsSectionElementId('bio', 'studio')}>
                <TextField label="Section heading" value={content.bio.studioTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioTitle: value } })} />
                <MediaImageField label="Studio image" value={content.bio.studioImage} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioImage: value } })} help="Optional. Leave blank to hide." />
                {content.bio.studioImage.trim() && (
                  <TextField label="Studio image description" value={content.bio.studioImageAlt} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioImageAlt: value } })} help="Short alt text for accessibility." />
                )}
                <HtmlField label="Process / studio notes" value={content.bio.studioPracticeHtml} onChange={(value) => setContent({ ...content, bio: { ...content.bio, studioPracticeHtml: value } })} />
              </EditorSection>
            )}
            {(content.bio.showBackground || content.bio.showAchievements) && (
              <EditorSection title="Optional CV blocks" id={cmsSectionElementId('bio', 'background')}>
                {content.bio.showBackground && (
                  <>
                    <TextField label="Path heading" value={content.bio.backgroundTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, backgroundTitle: value } })} />
                    <HtmlField label="Your path" value={content.bio.backgroundHtml} help="Optional. School, self-taught route, or anything that frames your practice." onChange={(value) => setContent({ ...content, bio: { ...content.bio, backgroundHtml: value } })} />
                  </>
                )}
                {content.bio.showAchievements && (
                  <>
                    <TextField label="Recognition heading" value={content.bio.achievementsTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, achievementsTitle: value } })} />
                    <HtmlField label="Shows & recognition" value={content.bio.achievementsHtml} help="Optional. Exhibitions, awards, or residencies." onChange={(value) => setContent({ ...content, bio: { ...content.bio, achievementsHtml: value } })} />
                  </>
                )}
              </EditorSection>
            )}
            {content.bio.showCollections && (
              <EditorSection title="Collections & press" id={cmsSectionElementId('bio', 'collections')}>
                <TextField label="Section heading" value={content.bio.collectionsTitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, collectionsTitle: value } })} />
                <HtmlField label="Collections & press" value={content.bio.collectionsHtml} help="Optional press mentions or public/private collections." onChange={(value) => setContent({ ...content, bio: { ...content.bio, collectionsHtml: value } })} />
              </EditorSection>
            )}
            {content.bio.showCta && (
              <EditorSection title="Closing call to action" id={cmsSectionElementId('bio', 'cta')}>
                <TextField label="Closing section title" value={content.bio.cta.title} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, title: value } } })} />
                <TextAreaField label="Closing section subtitle" value={content.bio.cta.subtitle} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, subtitle: value } } })} />
                <TextField label="Closing portfolio button" value={content.bio.cta.portfolioLabel} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, portfolioLabel: value } } })} help="Leave blank to hide." />
                <TextField label="Closing shop button" value={content.bio.cta.shopLabel} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, shopLabel: value } } })} help="Leave blank to hide." />
                <TextField label="Closing contact button" value={content.bio.cta.contactLabel} onChange={(value) => setContent({ ...content, bio: { ...content.bio, cta: { ...content.bio.cta, contactLabel: value } } })} help="Leave blank to hide." />
              </EditorSection>
            )}
          </div>
        )}

        {activePage === 'contact' && (
          <div className="space-y-4">
            <EditorSection title="Contact page intro" defaultOpen id={cmsSectionElementId('contact', 'header')}>
              <TextField label="Page title" value={content.contact.header.title} onChange={(value) => setContent({ ...content, contact: { ...content.contact, header: { ...content.contact.header, title: value } } })} />
              <TextAreaField label="Page subtitle" value={content.contact.header.subtitle} onChange={(value) => setContent({ ...content, contact: { ...content.contact, header: { ...content.contact.header, subtitle: value } } })} />
              <TextField label="Form heading" value={content.contact.form.title} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, title: value } } })} />
              <TextField label="Submit button" value={content.contact.form.submitLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, submitLabel: value } } })} />
              <TextAreaField label="Success message" value={content.contact.form.successMessage} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, successMessage: value } } })} />
            </EditorSection>
            <EditorSection title="Form field labels & placeholders">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Inquiry label" value={content.contact.form.inquiryLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, inquiryLabel: value } } })} />
                <TextField label="Name label" value={content.contact.form.nameLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, nameLabel: value } } })} />
                <TextField label="Email label" value={content.contact.form.emailLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, emailLabel: value } } })} />
                <TextField label="Subject label" value={content.contact.form.subjectLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, subjectLabel: value } } })} />
                <TextField label="Message label" value={content.contact.form.messageLabel} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, messageLabel: value } } })} />
                <TextField label="Name placeholder" value={content.contact.form.namePlaceholder} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, namePlaceholder: value } } })} />
                <TextField label="Email placeholder" value={content.contact.form.emailPlaceholder} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, emailPlaceholder: value } } })} />
                <TextField label="Subject placeholder" value={content.contact.form.subjectPlaceholder} onChange={(value) => setContent({ ...content, contact: { ...content.contact, form: { ...content.contact.form, subjectPlaceholder: value } } })} />
              </div>
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
            <PortfolioPresentationWizard
              portfolio={content.portfolio}
              onApply={(nextPortfolio) => setContent({ ...content, portfolio: nextPortfolio })}
            />
            <EditorSection title="Listing intro" defaultOpen id={cmsSectionElementId('portfolio', 'listing')}>
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
              <TextAreaField label="Page subtitle" value={content.portfolio.subtitle} onChange={(value) => setContent({ ...content, portfolio: { ...content.portfolio, subtitle: value } })} help="Optional line under the title. Leave blank for a quieter header." />
              <SelectField
                label="Artwork page layout"
                value={content.portfolio.artworkDetailLayout}
                onChange={(value) => setContent({ ...content, portfolio: { ...content.portfolio, artworkDetailLayout: value as typeof content.portfolio.artworkDetailLayout } })}
                options={[
                  { value: 'standard', label: 'Standard — gallery and details side by side' },
                  { value: 'gallery-focus', label: 'Gallery focus — full-width image above details' },
                ]}
              />
            </EditorSection>
            <EditorSection title="Grid and images" defaultOpen>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <SelectField
                  label="Thumbnail shape"
                  value={content.portfolio.layout.thumbAspect}
                  onChange={(value) => setContent({
                    ...content,
                    portfolio: {
                      ...content.portfolio,
                      layout: { ...content.portfolio.layout, thumbAspect: value as typeof content.portfolio.layout.thumbAspect },
                    },
                  })}
                  options={[
                    { value: 'square', label: 'Square' },
                    { value: 'portrait', label: 'Portrait' },
                    { value: 'landscape', label: 'Landscape' },
                  ]}
                  help="Masonry uses portrait thumbnails automatically."
                />
                <SelectField
                  label="Image fit"
                  value={content.portfolio.layout.imageFit}
                  onChange={(value) => setContent({
                    ...content,
                    portfolio: {
                      ...content.portfolio,
                      layout: { ...content.portfolio.layout, imageFit: value as typeof content.portfolio.layout.imageFit },
                    },
                  })}
                  options={[
                    { value: 'cover', label: 'Fill frame (may crop)' },
                    { value: 'contain', label: 'Show full artwork (letterbox)' },
                  ]}
                />
              </div>
              <CheckboxField
                label="Masonry layout"
                checked={content.portfolio.layout.masonry}
                onChange={(value) => setContent({
                  ...content,
                  portfolio: {
                    ...content.portfolio,
                    layout: { ...content.portfolio.layout, masonry: value },
                  },
                })}
                help="Column flow with taller portrait frames."
              />
              <CheckboxField
                label="Show category filters"
                checked={content.portfolio.layout.showFilters}
                onChange={(value) => setContent({
                  ...content,
                  portfolio: {
                    ...content.portfolio,
                    layout: { ...content.portfolio.layout, showFilters: value },
                  },
                })}
                help="Filters appear once you define categories below."
              />
              <CheckboxField
                label="Also show artwork tags not listed below"
                checked={content.portfolio.layout.includeUnlistedCategories}
                onChange={(value) => setContent({
                  ...content,
                  portfolio: {
                    ...content.portfolio,
                    layout: { ...content.portfolio.layout, includeUnlistedCategories: value },
                  },
                })}
                help="Off by default so your filter list stays intentional."
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <CheckboxField
                  label="Show featured badge"
                  checked={content.portfolio.layout.showFeaturedBadge}
                  onChange={(value) => setContent({
                    ...content,
                    portfolio: {
                      ...content.portfolio,
                      layout: { ...content.portfolio.layout, showFeaturedBadge: value },
                    },
                  })}
                />
                <CheckboxField
                  label="Show not available badge"
                  checked={content.portfolio.layout.showSoldBadge}
                  onChange={(value) => setContent({
                    ...content,
                    portfolio: {
                      ...content.portfolio,
                      layout: { ...content.portfolio.layout, showSoldBadge: value },
                    },
                  })}
                />
                <CheckboxField
                  label="Show medium / size / year"
                  checked={content.portfolio.layout.showMeta}
                  onChange={(value) => setContent({
                    ...content,
                    portfolio: {
                      ...content.portfolio,
                      layout: { ...content.portfolio.layout, showMeta: value },
                    },
                  })}
                />
                <CheckboxField
                  label="Show price on cards"
                  checked={content.portfolio.layout.showPrice}
                  onChange={(value) => setContent({
                    ...content,
                    portfolio: {
                      ...content.portfolio,
                      layout: { ...content.portfolio.layout, showPrice: value },
                    },
                  })}
                  help="Off by default — keep prices on the shop if you prefer a quieter portfolio."
                />
              </div>
            </EditorSection>
            <EditorSection title="Categories" defaultOpen>
              <PortfolioCategoryEditor
                items={content.portfolio.categories}
                artworkTags={Array.from(new Set(artworkOptions.flatMap((artwork) => artwork.category)))}
                onChange={(categories) => setContent({
                  ...content,
                  portfolio: { ...content.portfolio, categories },
                })}
              />
            </EditorSection>
          </div>
        )}

        {activePage === 'shop' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField
                label="Grid columns"
                value={content.shop.layout.gridColumns}
                onChange={(value) => setContent({
                  ...content,
                  shop: { ...content.shop, layout: { ...content.shop.layout, gridColumns: value as typeof content.shop.layout.gridColumns } },
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
                  shop: { ...content.shop, layout: { ...content.shop.layout, showFilters: value } },
                })}
              />
            </div>
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
              <HtmlField label="What happens next" value={content.shop.successNextStepsHtml} onChange={(value) => setContent({ ...content, shop: { ...content.shop, successNextStepsHtml: value } })} help="Shown on the order confirmation page after checkout." />
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
              {content.shop.showPurchaseInfo && (
                <>
                  <TextField label="Section title" value={content.shop.purchaseInfo.title} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, title: value } } })} />
                  <TextField label="Authenticity heading" value={content.shop.purchaseInfo.authenticityTitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, authenticityTitle: value } } })} />
                  <TextAreaField label="Authenticity text" value={content.shop.purchaseInfo.authenticityText} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, authenticityText: value } } })} />
                  <TextField label="Shipping heading" value={content.shop.purchaseInfo.shippingTitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, shippingTitle: value } } })} />
                  <TextAreaField label="Shipping text" value={content.shop.purchaseInfo.shippingText} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, shippingText: value } } })} />
                  <TextField label="Commissions heading" value={content.shop.purchaseInfo.commissionsTitle} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, commissionsTitle: value } } })} />
                  <TextAreaField label="Commissions text" value={content.shop.purchaseInfo.commissionsText} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, commissionsText: value } } })} />
                  <TextField label="Contact button" value={content.shop.purchaseInfo.ctaLabel} onChange={(value) => setContent({ ...content, shop: { ...content.shop, purchaseInfo: { ...content.shop.purchaseInfo, ctaLabel: value } } })} help="Leave blank to hide." />
                </>
              )}
            </EditorSection>
          </div>
        )}

        {activePage === 'blog' && (
          <div className="space-y-4" id={cmsSectionElementId('blog', 'listing')}>
            <p className="text-sm text-gray-600">
              Header and footer link text lives in{' '}
              <button
                type="button"
                onClick={() => selectPageTab('identity', 'navigation')}
                className="font-medium text-primary hover:underline"
              >
                Branding → Navigation
              </button>
              . This page controls the Updates feed itself.
            </p>
            <EditorSection title="Feed header & layout" defaultOpen>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Listing header size"
                  value={content.blog.hero.height}
                  onChange={(value) => setContent({ ...content, blog: { ...content.blog, hero: { ...content.blog.hero, height: value as typeof content.blog.hero.height } } })}
                  options={[
                    { value: 'compact', label: 'Compact' },
                    { value: 'full', label: 'Spacious' },
                  ]}
                />
                <SelectField
                  label="Feed layout"
                  value={content.blog.feedLayout}
                  onChange={(value) => setContent({ ...content, blog: { ...content.blog, feedLayout: value as typeof content.blog.feedLayout } })}
                  options={[
                    { value: 'timeline', label: 'Timeline (captions under media)' },
                    { value: 'grid', label: 'Grid (studio wall)' },
                  ]}
                />
              </div>
              <TextField label="Page title" value={content.blog.title} onChange={(value) => setContent({ ...content, blog: { ...content.blog, title: value } })} />
              <TextAreaField label="Page subtitle" value={content.blog.subtitle} onChange={(value) => setContent({ ...content, blog: { ...content.blog, subtitle: value } })} />
              <CheckboxField label="Show journal / studio filters" checked={content.blog.showFormatFilters} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showFormatFilters: value } })} />
              {content.blog.showFormatFilters && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TextField label="Journal filter label" value={content.blog.journalLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, journalLabel: value } })} />
                  <TextField label="Studio filter label" value={content.blog.studioLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, studioLabel: value } })} />
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-3">
                <CheckboxField label="Show dates" checked={content.blog.showFeedDate} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showFeedDate: value } })} />
                <CheckboxField label="Show author" checked={content.blog.showFeedAuthor} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showFeedAuthor: value } })} />
                <CheckboxField label="Show tags" checked={content.blog.showFeedTags} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showFeedTags: value } })} />
              </div>
            </EditorSection>
            <EditorSection title="Collector-only section">
              <CheckboxField label="Show collector-only section" checked={content.blog.showPrivateSection} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showPrivateSection: value } })} help="Private updates appear only to signed-in emails you whitelist on the post." />
              {content.blog.showPrivateSection && (
                <>
                  <TextField label="Collector section title" value={content.blog.privateSectionTitle} onChange={(value) => setContent({ ...content, blog: { ...content.blog, privateSectionTitle: value } })} />
                  <TextAreaField label="Collector section description" value={content.blog.privateSectionSubtitle} onChange={(value) => setContent({ ...content, blog: { ...content.blog, privateSectionSubtitle: value } })} />
                  <TextField label="Sign-in button" value={content.blog.privateSignInLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, privateSignInLabel: value } })} />
                </>
              )}
            </EditorSection>
            <EditorSection title="Reactions, comments & labels">
              <CheckboxField label="Show comments on updates" checked={content.blog.showComments} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showComments: value } })} help="Signed-in visitors comment on the post page; hide or restore comments in Inbox." />
              <CheckboxField label="Show likes on updates" checked={content.blog.showLikes} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showLikes: value } })} help="Anyone can like without signing in." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {content.blog.showComments && (
                  <TextField label="Comments section label" value={content.blog.commentsLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, commentsLabel: value } })} />
                )}
                {content.blog.showLikes && (
                  <TextField label="Like button label" value={content.blog.likeLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, likeLabel: value } })} />
                )}
                <TextField label="Quick look button" value={content.blog.quickLookLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, quickLookLabel: value } })} />
                <TextField label="Save update button" value={content.blog.saveUpdateLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, saveUpdateLabel: value } })} />
                <TextField label="Ask artist button" value={content.blog.askArtistLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, askArtistLabel: value } })} />
                <TextField label="Featured badge label" value={content.blog.featuredLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, featuredLabel: value } })} />
                <TextField label="Public tab label" value={content.blog.publicTabLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, publicTabLabel: value } })} />
                <TextField label="All filter label" value={content.blog.allFilterLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, allFilterLabel: value } })} />
              </div>
            </EditorSection>
            <EditorSection title="Subscriptions & email digests">
              <CheckboxField label="Show subscribe button" checked={content.blog.showSubscribe} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showSubscribe: value } })} />
              {content.blog.showSubscribe && (
                <TextField label="Subscribe button label" value={content.blog.subscribeLabel} onChange={(value) => setContent({ ...content, blog: { ...content.blog, subscribeLabel: value } })} />
              )}
              <CheckboxField label="Show RSS and Atom feeds" checked={content.blog.showRss} onChange={(value) => setContent({ ...content, blog: { ...content.blog, showRss: value } })} />
              <div className="space-y-3 border-t border-gray-100 pt-3">
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
                {content.blog.autoOrderProgressPost !== 'off' && (
                  <TextAreaField label="Order progress update template" value={content.blog.autoOrderProgressExcerpt} onChange={(value) => setContent({ ...content, blog: { ...content.blog, autoOrderProgressExcerpt: value } })} help="Use {{summary}} and {{orderNumber}} placeholders." />
                )}
              </div>
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <CheckboxField label="Send public updates digest email" checked={content.blog.digestEnabled} onChange={(value) => setContent({ ...content, blog: { ...content.blog, digestEnabled: value } })} />
                {content.blog.digestEnabled && (
                  <>
                    <BoundedIntField
                      label="Digest interval (days)"
                      value={content.blog.digestIntervalDays}
                      min={1}
                      max={30}
                      onChange={(digestIntervalDays) => setContent({ ...content, blog: { ...content.blog, digestIntervalDays } })}
                      help="Between 1 and 30 days."
                    />
                    <TextField label="Digest email subject" value={content.blog.digestSubject} onChange={(value) => setContent({ ...content, blog: { ...content.blog, digestSubject: value } })} />
                    <TextAreaField label="Digest email intro" value={content.blog.digestIntro} onChange={(value) => setContent({ ...content, blog: { ...content.blog, digestIntro: value } })} />
                  </>
                )}
              </div>
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <CheckboxField label="Send collector private-updates digest" checked={content.blog.collectorDigestEnabled} onChange={(value) => setContent({ ...content, blog: { ...content.blog, collectorDigestEnabled: value } })} />
                {content.blog.collectorDigestEnabled && (
                  <>
                    <TextField label="Collector digest subject" value={content.blog.collectorDigestSubject} onChange={(value) => setContent({ ...content, blog: { ...content.blog, collectorDigestSubject: value } })} />
                    <TextAreaField label="Collector digest intro" value={content.blog.collectorDigestIntro} onChange={(value) => setContent({ ...content, blog: { ...content.blog, collectorDigestIntro: value } })} />
                  </>
                )}
              </div>
            </EditorSection>
          </div>
        )}

        <div className="sticky bottom-above-admin-nav md:bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-3 rounded-b-lg border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
          <p className="mr-auto text-xs text-gray-600" role="status">
            {isDirty
              ? `Unsaved changes on ${dirtyPages.map((page) => PAGE_TABS.find((tab) => tab.key === page)?.label ?? page).join(', ')}`
              : 'All changes published'}
          </p>
          {isDirty && saved && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (!window.confirm('Discard all unsaved page changes?')) return;
                setContent(saved);
                setLegalPages(savedLegalPages);
                setMessage('Unsaved changes discarded.');
                void clearPreview();
              }}
              className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Discard changes
            </button>
          )}
          <button type="submit" disabled={saving || !isDirty} className="btn-primary shrink-0 whitespace-nowrap px-5 py-2 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <div className="scroll-mt-24 rounded-lg border bg-white overflow-hidden xl:sticky xl:top-28">
        <div className="border-b px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Live preview</h3>
            <p className="text-xs text-gray-500">Updates as you edit — save to publish changes.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPreviewOpen((open) => !open)}
              className="inline-flex min-h-9 items-center text-sm font-medium text-gray-700 hover:text-gray-900"
              aria-expanded={previewOpen}
            >
              {previewOpen ? 'Hide preview' : 'Show preview'}
            </button>
            {isDirty && (
              <a href={`${previewHref}?cmsPreview=1&preview=${previewToken}`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center text-sm font-medium text-primary hover:opacity-80">
                Open draft ↗
              </a>
            )}
          </div>
        </div>
        {previewOpen && (
          <iframe
            key={`${activePage}-${previewToken}`}
            title={`Preview ${activeTab.label}`}
            src={`${previewHref}?cmsPreview=1&preview=${previewToken}`}
            className="w-full h-[min(70vh,720px)] bg-white"
          />
        )}
      </div>
      </div>
    </div>
  );
}
