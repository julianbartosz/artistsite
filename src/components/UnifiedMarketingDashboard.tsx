// Unified Marketing Dashboard System
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeExternalHref } from '@/lib/site-content-shared';
import type { LucideIcon } from 'lucide-react';
import { Megaphone, Smartphone, Tag } from 'lucide-react';
import { IntegerField, MoneyField } from '@/components/admin/StudioFormFields';
import GalleryField from '@/components/admin/GalleryField';
import { AUTOMATION_EMAIL_IDS } from '@/lib/newsletter';

type MarketingView = 'promos' | 'social' | 'ads';

interface CampaignPerformance {
  impressions?: number;
  clicks?: number;
  conversions?: number;
  cost?: number;
  roas?: number;
}

interface CampaignContent {
  platform?: string;
  performance?: CampaignPerformance;
  [key: string]: unknown;
}

interface CampaignSummary {
  id: string;
  type: 'social' | 'ad';
  name: string;
  status: string;
  performance: string;
  content?: CampaignContent;
  scheduledAt?: string;
}

interface CampaignDraft {
  name: string;
  platform: string;
  content: string;
  mediaUrls: string[];
  budgetAmount: number | '';
  scheduledAt: string;
}

interface ShareAssistPayload {
  platform: string;
  label: string;
  caption: string;
  mediaUrls: string[];
  links: Array<{ label: string; url: string }>;
  instructions: string[];
}

interface CampaignsResponse {
  social: CampaignSummary[];
  ads: CampaignSummary[];
}

interface PromoCodeRecord {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null;
}

function resolveMarketingView(raw: string | null): MarketingView {
  if (raw === 'social' || raw === 'ads') return raw;
  return 'promos';
}

export function UnifiedMarketingDashboard({
  onSelectTab,
}: {
  onSelectTab?: (tab: string) => void;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const [view, setView] = useState<MarketingView>(() => resolveMarketingView(viewParam));

  const [promoCodes, setPromoCodes] = useState<PromoCodeRecord[]>([]);
  const [promosLoading, setPromosLoading] = useState(true);
  const [cartRecoveryPromo, setCartRecoveryPromo] = useState<string>('');
  const [campaigns, setCampaigns] = useState<CampaignsResponse>({ social: [], ads: [] });
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);

  useEffect(() => {
    setView(resolveMarketingView(viewParam));
  }, [viewParam]);

  const selectView = useCallback((nextView: MarketingView) => {
    setView(nextView);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'marketing');
    if (nextView === 'promos') params.delete('view');
    else params.set('view', nextView);
    const nextUrl = `/admin?${params.toString()}`;
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', nextUrl);
    } else {
      router.replace(nextUrl, { scroll: false });
    }
  }, [router, searchParams]);

  const loadPromoCodes = useCallback(async () => {
    try {
      const [promosRes, settingsRes] = await Promise.all([
        fetch('/api/admin/promo-codes'),
        fetch('/api/admin/settings'),
      ]);
      const promosData = await promosRes.json().catch(() => ({}));
      if (promosRes.ok) {
        setPromoCodes(promosData.promoCodes || []);
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json().catch(() => ({}));
        const record = (settingsData.settings || []).find(
          (entry: { key: string; value?: string }) => entry.key === 'CART_RECOVERY_PROMO_CODE',
        );
        setCartRecoveryPromo(record?.value?.trim() || '');
      }
    } finally {
      setPromosLoading(false);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const response = await fetch('/api/marketing/campaigns');
      if (!response.ok) throw new Error('Failed to load campaigns');
      const data = await response.json();
      setCampaigns({
        social: Array.isArray(data.social) ? data.social : [],
        ads: Array.isArray(data.ads) ? data.ads : [],
      });
      setCampaignsError(null);
    } catch (error) {
      setCampaignsError(error instanceof Error ? error.message : 'Failed to load campaigns');
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPromoCodes();
    void loadCampaigns();
  }, [loadPromoCodes, loadCampaigns]);

  const pillClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-gray-900 text-white'
        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div data-testid="marketing-dashboard" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Marketing</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            Create checkout promo codes, draft social posts, and track ad spend.{' '}
            {onSelectTab ? (
              <button
                type="button"
                onClick={() => onSelectTab('markets')}
                className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
              >
                Open Markets
              </button>
            ) : (
              <Link
                href="/admin?tab=markets"
                className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
              >
                Open Markets
              </Link>
            )}{' '}
            for booth QR codes and printed price sheets.
          </p>
        </div>
        {onSelectTab ? (
          <button
            type="button"
            onClick={() => onSelectTab('analytics')}
            className="shrink-0 self-start whitespace-nowrap rounded-md border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:self-auto"
          >
            View channel performance →
          </button>
        ) : (
          <Link
            href="/admin?tab=analytics"
            className="shrink-0 self-start whitespace-nowrap rounded-md border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:self-auto"
          >
            View channel performance →
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Marketing tools">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'promos'}
          onClick={() => selectView('promos')}
          className={pillClass(view === 'promos')}
        >
          <Tag className="h-4 w-4" aria-hidden="true" />
          <span>Promo codes</span>
          {!promosLoading && <span className="ml-0.5 opacity-70">{promoCodes.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'social'}
          onClick={() => selectView('social')}
          className={pillClass(view === 'social')}
        >
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          <span>Social posts</span>
          {!campaignsLoading && <span className="ml-0.5 opacity-70">{campaigns.social.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'ads'}
          onClick={() => selectView('ads')}
          className={pillClass(view === 'ads')}
        >
          <Megaphone className="h-4 w-4" aria-hidden="true" />
          <span>Ad spend</span>
          {!campaignsLoading && <span className="ml-0.5 opacity-70">{campaigns.ads.length}</span>}
        </button>
      </div>

      {view === 'promos' && (
        <PromoCodesPanel
          promoCodes={promoCodes}
          loading={promosLoading}
          cartRecoveryPromo={cartRecoveryPromo}
          onCartRecoveryChanged={setCartRecoveryPromo}
          onReload={loadPromoCodes}
          onSelectTab={onSelectTab}
        />
      )}

      {(view === 'social' || view === 'ads') && (
        <CampaignsWorkspace
          campaignType={view === 'social' ? 'social' : 'ad'}
          campaigns={view === 'social' ? campaigns.social : campaigns.ads}
          loading={campaignsLoading}
          error={campaignsError}
          onReload={loadCampaigns}
          onSelectTab={onSelectTab}
        />
      )}
    </div>
  );
}

function CampaignsWorkspace({
  campaignType,
  campaigns,
  loading,
  error,
  onReload,
  onSelectTab,
}: {
  campaignType: 'social' | 'ad';
  campaigns: CampaignSummary[];
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
  onSelectTab?: (tab: string) => void;
}) {
  const [draft, setDraft] = useState<CampaignDraft>({
    name: '',
    platform: 'instagram',
    content: '',
    mediaUrls: [],
    budgetAmount: 0,
    scheduledAt: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [shareAssist, setShareAssist] = useState<{
    campaignId: string;
    assist: ShareAssistPayload;
    publishError?: string;
  } | null>(null);

  useEffect(() => {
    setMessage(null);
    setShareAssist(null);
    setDraft((current) => ({
      ...current,
      platform: campaignType === 'social' && current.platform === 'google' ? 'instagram' : current.platform,
    }));
  }, [campaignType]);

  const resetDraft = () => setDraft({
    name: '',
    platform: 'instagram',
    content: '',
    mediaUrls: [] as string[],
    budgetAmount: 0,
    scheduledAt: '',
  });

  const parseListValue = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    if (typeof value !== 'string') return [];
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  };

  const canSave = Boolean(String(draft.name || '').trim()) && (campaignType === 'ad' || Boolean(String(draft.content || '').trim()));

  const saveCampaign = async () => {
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    setShareAssist(null);
    const payload = {
      ...draft,
      type: campaignType,
      mediaUrls: parseListValue(draft.mediaUrls),
      scheduledAt: draft.scheduledAt || null,
      budgetAmount: Number(draft.budgetAmount || 0),
      startDate: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save campaign');

      resetDraft();
      await onReload();
      setMessage({ tone: 'info', text: campaignType === 'social' ? 'Social post draft saved.' : 'Ad spend entry saved.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to save campaign' });
    } finally {
      setSaving(false);
    }
  };

  const runCampaign = async (id: string, type: 'social' | 'ad') => {
    setMessage(null);
    setShareAssist(null);
    try {
      const response = await fetch(`/api/marketing/campaigns/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to run campaign');
      await onReload();
      if (data.campaign?.publishAssist) {
        setShareAssist({
          campaignId: id,
          assist: data.campaign.publishAssist,
          publishError: typeof data.campaign.publishError === 'string' ? data.campaign.publishError : undefined,
        });
        setMessage({
          tone: 'info',
          text: data.campaign.publishError
            ? 'Auto-publish could not complete. Use the manual post assist below.'
            : 'Caption and links are ready below. Post on the platform, then click Mark as posted.',
        });
      } else if (type === 'ad') {
        setMessage({ tone: 'info', text: 'Ad log marked active. Record results after you run the campaign in the ads manager.' });
      } else {
        setMessage({ tone: 'info', text: 'Campaign status updated.' });
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to run campaign' });
    }
  };

  const deleteCampaign = async (id: string) => {
    setMessage(null);
    setShareAssist(null);
    try {
      const response = await fetch(`/api/marketing/campaigns/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete campaign');
      await onReload();
      setMessage({ tone: 'info', text: campaignType === 'social' ? 'Social post deleted.' : 'Ad spend entry deleted.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to delete campaign' });
    }
  };

  const saveAdActuals = async (campaign: CampaignSummary, actuals: { impressions: number; clicks: number; conversions: number; cost: number; roas: number }) => {
    setMessage(null);
    setShareAssist(null);
    try {
      const response = await fetch(`/api/marketing/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ad', action: 'record_performance', ...actuals }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save ad results');
      await onReload();
      setMessage({ tone: 'info', text: 'Ad results saved.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to save ad results' });
    }
  };

  const markSocialPostedById = async (campaignId: string) => {
    setMessage(null);
    setShareAssist(null);
    try {
      const response = await fetch(`/api/marketing/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'social', action: 'mark_posted' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to mark post as published');
      await onReload();
      setMessage({ tone: 'info', text: 'Social post marked as published.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to mark post as published' });
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border p-3.5 text-sm ${
            message.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {shareAssist && (
        <ShareAssistPanel
          assist={shareAssist.assist}
          publishError={shareAssist.publishError}
          onMarkPosted={() => void markSocialPostedById(shareAssist.campaignId)}
          onDismiss={() => setShareAssist(null)}
        />
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {campaignType === 'social' ? 'Draft social post' : 'Log ad spend'}
          </h3>
          <p className="mt-0.5 text-sm text-gray-600">
            {campaignType === 'social' ? (
              <>
                Opens a copy-and-post assist (or auto-publishes when configured in Settings → Integrations). Email broadcasts live under{' '}
                {onSelectTab ? (
                  <button
                    type="button"
                    onClick={() => onSelectTab('newsletter')}
                    className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
                  >
                    Newsletter
                  </button>
                ) : (
                  <Link href="/admin?tab=newsletter" className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700">
                    Newsletter
                  </Link>
                )}
                .
              </>
            ) : (
              'Track ad budget and results you enter by hand. This log does not buy ads on Google or Meta — use “Open ads manager” to run campaigns on the platform itself.'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Name
            <input
              value={draft.name}
              placeholder={campaignType === 'social' ? 'Spring print release teaser' : 'Holiday Instagram boost'}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Platform
            <select
              value={draft.platform}
              onChange={(event) => setDraft({ ...draft, platform: event.target.value })}
              className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
            >
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              {campaignType === 'ad' && <option value="google">Google</option>}
              <option value="pinterest">Pinterest</option>
              <option value="twitter">X (Twitter)</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </label>
          {campaignType === 'ad' && (
            <MoneyField
              label="Budget"
              value={draft.budgetAmount === '' || draft.budgetAmount === undefined || draft.budgetAmount === null
                ? ''
                : Number(draft.budgetAmount)}
              onChange={(next) => setDraft({ ...draft, budgetAmount: next === '' ? '' : next })}
            />
          )}
          <label className="text-sm font-medium text-gray-700">
            Schedule (optional)
            <input
              type="datetime-local"
              value={draft.scheduledAt}
              onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })}
              className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
            />
          </label>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            {campaignType === 'social' ? 'Caption' : 'Notes (optional)'}
            <textarea
              value={draft.content}
              placeholder={campaignType === 'social' ? 'Write your caption and hashtags…' : 'Audience, creative notes, or campaign link…'}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              rows={campaignType === 'social' ? 4 : 3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
            />
          </label>
          {campaignType === 'social' && (
            <GalleryField
              label="Post media"
              help="Upload images or pick from your Media Library for this social post."
              value={Array.isArray(draft.mediaUrls) ? draft.mediaUrls : []}
              onChange={(next) => setDraft({ ...draft, mediaUrls: next })}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void saveCampaign()}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : campaignType === 'social' ? 'Save draft' : 'Save ad entry'}
          </button>
        </div>
      </div>

      <CampaignSection
        title={campaignType === 'social' ? 'Saved social posts' : 'Ad spend log'}
        emptyText={
          campaignType === 'social'
            ? 'No social posts drafted yet. Draft one above to prepare captions and artwork images.'
            : 'No ad spend entries yet. Log external Google or Meta campaigns above to track ROI in Analytics.'
        }
        icon={campaignType === 'social' ? Smartphone : Megaphone}
        campaigns={campaigns}
        onRun={(campaign) => runCampaign(campaign.id, campaign.type)}
        onDelete={(campaign) => deleteCampaign(campaign.id)}
        onMarkPosted={campaignType === 'social' ? (campaign) => markSocialPostedById(campaign.id) : undefined}
        onSaveActuals={campaignType === 'ad' ? saveAdActuals : undefined}
      />
    </div>
  );
}

function ShareAssistPanel({
  assist,
  publishError,
  onMarkPosted,
  onDismiss,
}: {
  assist: ShareAssistPayload;
  publishError?: string;
  onMarkPosted: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyCaption = async () => {
    await navigator.clipboard?.writeText(assist.caption);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const safeMediaUrls = assist.mediaUrls.filter((url) => {
    const trimmed = url.trim();
    return Boolean(safeExternalHref(trimmed) || (trimmed.startsWith('/') && !trimmed.startsWith('//')));
  });
  const safeLinks = assist.links.filter((link) => Boolean(safeExternalHref(link.url)));

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold">{assist.label}</h3>
          <p className="mt-1 text-xs text-amber-900">Step 1: Copy caption · Step 2: Open platform · Step 3: Mark as posted</p>
          {publishError && (
            <p className="mt-2 rounded border border-amber-300 bg-white/80 px-2.5 py-1.5 text-xs text-amber-900">
              Auto-publish could not finish ({publishError}). You can still post manually below.
            </p>
          )}
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {assist.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
          </ul>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={copyCaption} className="rounded-md bg-amber-900 px-3 py-2 text-xs font-medium text-white hover:bg-amber-800">
            {copied ? 'Copied!' : 'Copy caption'}
          </button>
          <button type="button" onClick={onDismiss} className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100">
            Close
          </button>
        </div>
      </div>
      <div className="mt-4 whitespace-pre-wrap rounded border border-amber-200 bg-white p-3">{assist.caption}</div>
      {safeMediaUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {safeMediaUrls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="rounded border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900">Open media</a>)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {safeLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded-md bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800">{link.label}</a>)}
        <button
          type="button"
          onClick={onMarkPosted}
          className="rounded-md border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800"
        >
          Mark as posted
        </button>
      </div>
    </div>
  );
}

function PromoCodesPanel({
  promoCodes,
  loading,
  cartRecoveryPromo,
  onCartRecoveryChanged,
  onReload,
  onSelectTab,
}: {
  promoCodes: PromoCodeRecord[];
  loading: boolean;
  cartRecoveryPromo: string;
  onCartRecoveryChanged: (code: string) => void;
  onReload: () => Promise<void>;
  onSelectTab?: (tab: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string; showAutomationsLink?: boolean } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '10',
    usageLimit: '',
    expiresAt: '',
  });

  const canCreate = Boolean(draft.code.trim()) && Number(draft.discountValue) > 0;

  async function createPromoCode() {
    if (!canCreate) return;
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: draft.code.trim(),
          discountType: draft.discountType,
          discountValue: Number(draft.discountValue),
          usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
          expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create promo code');
      setDraft({ code: '', discountType: 'percentage', discountValue: '10', usageLimit: '', expiresAt: '' });
      setMessage({ tone: 'info', text: 'Promo code created. Collectors can enter it at checkout.' });
      await onReload();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to create promo code' });
    } finally {
      setCreating(false);
    }
  }

  async function assignCartRecoveryPromo(code: string) {
    setMessage(null);
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { CART_RECOVERY_PROMO_CODE: code } }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage({ tone: 'error', text: data.error || 'Failed to save cart recovery promo' });
      return;
    }
    onCartRecoveryChanged(code);
    setMessage({
      tone: 'info',
      text: `Saved ${code} as your cart recovery promo code. Make sure Cart recovery is enabled under Grow → Automations.`,
      showAutomationsLink: true,
    });
  }

  async function deletePromoCode(promo: PromoCodeRecord) {
    if (!window.confirm(`Delete promo code ${promo.code}?`)) return;
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/promo-codes/${encodeURIComponent(promo.id)}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to delete promo code');
      if (cartRecoveryPromo.toUpperCase() === promo.code.toUpperCase()) {
        onCartRecoveryChanged('');
      }
      setMessage({ tone: 'info', text: `Promo code ${promo.code} deleted.` });
      await onReload();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to delete promo code' });
    }
  }

  const cartRecoveryHref = `/admin?tab=automations&automation=${encodeURIComponent(AUTOMATION_EMAIL_IDS.cartRecovery)}`;

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Promo codes</h3>
        <p className="mt-0.5 text-sm text-gray-600">Create a discount code collectors can enter at checkout or receive in cart recovery emails.</p>
      </div>
      {message && (
        <div
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${
            message.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          <span>{message.text}</span>
          {message.showAutomationsLink && (
            <Link href={cartRecoveryHref} className="shrink-0 font-medium underline">
              Open Cart recovery →
            </Link>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label className="text-sm font-medium text-gray-700">
          Code
          <input
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
            className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
            placeholder="SPRING10"
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Type
          <select
            value={draft.discountType}
            onChange={(e) => setDraft({ ...draft, discountType: e.target.value as 'percentage' | 'fixed' })}
            className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </label>
        {draft.discountType === 'percentage' ? (
          <IntegerField
            label="Value (%)"
            min={0}
            max={100}
            value={draft.discountValue === '' ? '' : Number(draft.discountValue)}
            onChange={(next) => setDraft({ ...draft, discountValue: next === '' ? '' : String(next) })}
          />
        ) : (
          <MoneyField
            label="Value"
            value={draft.discountValue === '' ? '' : Number(draft.discountValue)}
            onChange={(next) => setDraft({ ...draft, discountValue: next === '' ? '' : String(next) })}
          />
        )}
        <IntegerField
          label="Usage limit"
          min={1}
          placeholder="Optional"
          value={draft.usageLimit === '' ? '' : Number(draft.usageLimit)}
          onChange={(next) => setDraft({ ...draft, usageLimit: next === '' ? '' : String(next) })}
        />
        <label className="text-sm font-medium text-gray-700">
          Expires
          <input
            type="datetime-local"
            value={draft.expiresAt}
            onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
            className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={!canCreate || creating}
        onClick={() => void createPromoCode()}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {creating ? 'Creating…' : 'Create promo code'}
      </button>
      {loading ? (
        <p className="text-sm text-gray-500">Loading promo codes...</p>
      ) : promoCodes.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          No promo codes yet. Create your first code above for shows, newsletter subscribers, or cart recovery.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {promoCodes.map((promo) => {
            const isCartRecoveryCode = Boolean(cartRecoveryPromo) && cartRecoveryPromo.toUpperCase() === promo.code.toUpperCase();
            return (
              <li key={promo.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{promo.code}</span>
                  <span className="text-gray-600">· {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `$${promo.discountValue}`}</span>
                  <span className="text-gray-500">· used {promo.usageCount}{promo.usageLimit ? `/${promo.usageLimit}` : ''}</span>
                  {isCartRecoveryCode && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      Cart recovery
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(promo.code);
                      setCopiedCode(promo.code);
                      window.setTimeout(() => setCopiedCode((current) => (current === promo.code ? null : current)), 2000);
                    }}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {copiedCode === promo.code ? 'Copied!' : 'Copy'}
                  </button>
                  {isCartRecoveryCode ? (
                    onSelectTab ? (
                      <button
                        type="button"
                        onClick={() => onSelectTab('automations')}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Manage in Automations →
                      </button>
                    ) : (
                      <Link
                        href={cartRecoveryHref}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Manage in Automations →
                      </Link>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => void assignCartRecoveryPromo(promo.code)}
                      className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Use for cart recovery
                    </button>
                  )}
                  {promo.usageCount === 0 && (
                    <button
                      type="button"
                      onClick={() => void deletePromoCode(promo)}
                      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CampaignSection({
  title,
  emptyText,
  icon,
  campaigns,
  onRun,
  onDelete,
  onSaveActuals,
  onMarkPosted,
}: {
  title: string;
  emptyText: string;
  icon: LucideIcon;
  campaigns: CampaignSummary[];
  onRun?: (campaign: CampaignSummary) => void;
  onDelete?: (campaign: CampaignSummary) => void;
  onSaveActuals?: (campaign: CampaignSummary, actuals: { impressions: number; clicks: number; conversions: number; cost: number; roas: number }) => void;
  onMarkPosted?: (campaign: CampaignSummary) => void;
}) {
  const [adActuals, setAdActuals] = useState<Record<string, { impressions: string; clicks: string; conversions: string; cost: string; roas: string }>>({});
  const Icon = icon;

  const runLabel = (campaign: CampaignSummary) => (campaign.type === 'social' ? 'Prepare post' : 'Mark active');

  const statusPresentation = (status: string, type: 'social' | 'ad') => {
    switch (status) {
      case 'published':
        return { label: 'Published', className: 'bg-green-100 text-green-800' };
      case 'active':
        return { label: 'Active', className: 'bg-green-100 text-green-800' };
      case 'needs_attention':
        return {
          label: type === 'social' ? 'Ready to post' : 'Needs attention',
          className: 'bg-amber-100 text-amber-900',
        };
      case 'scheduled':
        return { label: 'Scheduled', className: 'bg-blue-100 text-blue-800' };
      case 'paused':
        return { label: 'Paused', className: 'bg-yellow-100 text-yellow-800' };
      case 'failed':
        return { label: 'Failed', className: 'bg-red-100 text-red-800' };
      case 'draft':
        return { label: 'Draft', className: 'bg-gray-100 text-gray-700' };
      default:
        return { label: status.replaceAll('_', ' '), className: 'bg-gray-100 text-gray-700' };
    }
  };

  const adManagerUrl = (campaign: CampaignSummary): string | null => {
    const platform = String(campaign.content?.platform || '').toLowerCase();
    if (platform === 'google') return 'https://ads.google.com/aw/campaigns';
    if (platform === 'facebook' || platform === 'instagram') return 'https://business.facebook.com/adsmanager/manage/campaigns';
    if (platform === 'pinterest') return 'https://ads.pinterest.com/';
    if (platform === 'linkedin') return 'https://www.linkedin.com/campaignmanager/';
    if (platform === 'twitter' || platform === 'x') return 'https://ads.x.com/';
    return null;
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            {emptyText}
          </p>
        ) : campaigns.map((campaign) => {
          const badge = statusPresentation(campaign.status, campaign.type);
          return (
            <div key={campaign.id} className="rounded-md border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-gray-900">{campaign.name}</div>
                  <div className="mt-0.5 text-sm text-gray-600">{campaign.performance}</div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              {campaign.type === 'ad' && onSaveActuals && (() => {
                const performance = campaign.content?.performance || {};
                const managerUrl = adManagerUrl(campaign);
                const values = adActuals[campaign.id] || {
                  impressions: performance.impressions !== undefined ? String(performance.impressions) : '',
                  clicks: performance.clicks !== undefined ? String(performance.clicks) : '',
                  conversions: performance.conversions !== undefined ? String(performance.conversions) : '',
                  cost: performance.cost !== undefined ? String(performance.cost) : '',
                  roas: performance.roas !== undefined ? String(performance.roas) : '',
                };
                return (
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 text-xs sm:grid-cols-5">
                    <IntegerField
                      label="Impressions"
                      compact
                      min={0}
                      value={values.impressions === '' ? '' : Number(values.impressions)}
                      onChange={(next) => setAdActuals((current) => ({
                        ...current,
                        [campaign.id]: { ...values, impressions: next === '' ? '' : String(next) },
                      }))}
                    />
                    <IntegerField
                      label="Clicks"
                      compact
                      min={0}
                      value={values.clicks === '' ? '' : Number(values.clicks)}
                      onChange={(next) => setAdActuals((current) => ({
                        ...current,
                        [campaign.id]: { ...values, clicks: next === '' ? '' : String(next) },
                      }))}
                    />
                    <IntegerField
                      label="Conversions"
                      compact
                      min={0}
                      value={values.conversions === '' ? '' : Number(values.conversions)}
                      onChange={(next) => setAdActuals((current) => ({
                        ...current,
                        [campaign.id]: { ...values, conversions: next === '' ? '' : String(next) },
                      }))}
                    />
                    <MoneyField
                      label="Actual cost"
                      compact
                      value={values.cost === '' ? '' : Number(values.cost)}
                      onChange={(next) => setAdActuals((current) => ({
                        ...current,
                        [campaign.id]: { ...values, cost: next === '' ? '' : String(next) },
                      }))}
                    />
                    <MoneyField
                      label="ROAS"
                      compact
                      showCurrency={false}
                      value={values.roas === '' ? '' : Number(values.roas)}
                      onChange={(next) => setAdActuals((current) => ({
                        ...current,
                        [campaign.id]: { ...values, roas: next === '' ? '' : String(next) },
                      }))}
                    />
                    <div className="flex flex-wrap items-center gap-3 sm:col-span-5">
                      <button
                        type="button"
                        onClick={() => onSaveActuals(campaign, {
                          impressions: Number(values.impressions || 0),
                          clicks: Number(values.clicks || 0),
                          conversions: Number(values.conversions || 0),
                          cost: Number(values.cost || 0),
                          roas: Number(values.roas || 0),
                        })}
                        className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                      >
                        Save ad results
                      </button>
                      {managerUrl && (
                        <a href={managerUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-gray-700 underline hover:text-gray-900">
                          Open ads manager ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="mt-3 flex flex-wrap gap-3 border-t border-gray-100 pt-3">
                {onRun && <button type="button" onClick={() => onRun(campaign)} className="text-xs font-medium text-gray-900 hover:underline">{runLabel(campaign)}</button>}
                {campaign.type === 'social' && campaign.status !== 'published' && onMarkPosted && <button type="button" onClick={() => onMarkPosted(campaign)} className="text-xs font-medium text-emerald-700 hover:underline">Mark as posted</button>}
                {onDelete && <button type="button" onClick={() => onDelete(campaign)} className="ml-auto text-xs font-medium text-red-700 hover:underline">Delete</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
