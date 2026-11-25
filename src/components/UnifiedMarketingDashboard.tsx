// Unified Marketing Dashboard System
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { safeExternalHref } from '@/lib/site-content-shared';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, CreditCard, DollarSign, LineChart, Mail, Megaphone, Smartphone, Target, Users } from 'lucide-react';
import { IntegerField, MoneyField } from '@/components/admin/StudioFormFields';
import GalleryField from '@/components/admin/GalleryField';
import { MarketQrCard } from '@/components/admin/MarketQrCard';

import { AUTOMATION_EMAIL_IDS } from '@/lib/newsletter';

interface MarketingOverview {
  totalRevenue: number;
  totalCost: number;
  roi: number;
  activeCustomers: number;
  campaignPerformance: {
    email: { sent: number; opened: number; clicked: number; converted: number };
    social: { posts: number; engagement: number; reach: number; clicks: number };
    ads: { impressions: number; clicks: number; conversions: number; roas: number };
  };
  topPerformingChannels: Array<{
    channel: string;
    revenue: number;
    cost: number;
    roi: number;
    conversions: number;
  }>;
  automation?: {
    email: {
      active: number;
      total: number;
      sent: number;
      cartAbandonment: number;
      postPurchase: number;
      welcomeEnabled?: boolean;
      welcomeSeriesEnabled?: boolean;
      welcomeSent?: number;
      welcomeInstantSent?: number;
      welcomeFollowupSent?: number;
      winbackEnabled?: boolean;
      winbackInactiveDays?: number;
      winbackSent?: number;
      cartEnabled?: boolean;
    };
    social: { active: number; total: number; posts: number; provider?: 'assist' | 'meta' | 'ayrshare'; autoPublish?: boolean };
  };
  analytics?: {
    journey: Array<{ step: string; visitors: number }>;
    metrics: { averageLifetimeValue: number; averageEngagementScore: number; purchaseCount: number; activeProfiles: number };
  };
}

interface DashboardFilters {
  dateRange: '7d' | '30d' | '90d' | '1y';
  channels: string[];
  campaigns: string[];
}

interface CampaignSummary {
  id: string;
  type: 'social' | 'ad';
  name: string;
  status: string;
  performance: string;
  content?: Record<string, any>;
  scheduledAt?: string;
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

export function UnifiedMarketingDashboard({
  onSelectTab,
}: {
  onSelectTab?: (tab: string) => void;
} = {}) {
  const [overview, setOverview] = useState<MarketingOverview | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: '30d',
    channels: ['email', 'social', 'ads'],
    campaigns: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'performance'>('campaigns');

  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/marketing/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });
      if (!response.ok) {
        setOverview(null);
        return;
      }

      const overview = await response.json();
      setOverview(overview && typeof overview === 'object' ? overview : null);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="marketing-dashboard" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Marketing</h2>
          <p className="mt-0.5 text-sm text-gray-600">Promo codes, market QR codes, social posts, ad spend tracking, and channel performance.</p>
        </div>
        {activeTab === 'performance' && (
          <div className="flex flex-wrap items-center gap-3">
            <DateRangeSelector value={filters.dateRange} onChange={(range) => 
              setFilters({ ...filters, dateRange: range })
            } />
            <ChannelFilter 
              selected={filters.channels} 
              onChange={(channels) => setFilters({ ...filters, channels })}
            />
          </div>
        )}
      </div>

      {/* Tab Navigation — 2 crisp views (no duplicate Analytics sub-tab) */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto whitespace-nowrap">
          {[
            { key: 'campaigns', label: 'Campaigns & promos', Icon: Target },
            { key: 'performance', label: 'Performance', Icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as 'campaigns' | 'performance')}
              className={`shrink-0 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.Icon className="mr-2 inline h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'campaigns' && <CampaignsTab onSelectTab={onSelectTab} />}
      {activeTab === 'performance' && (
        loading && !overview ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            <OverviewTab overview={overview} onReload={loadDashboardData} onSelectTab={onSelectTab} />
            <PerformanceInsightsRow overview={overview} onSelectTab={onSelectTab} />
          </div>
        )
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  overview,
  onReload,
  onSelectTab,
}: {
  overview: MarketingOverview | null;
  onReload: () => void;
  onSelectTab?: (tab: string) => void;
}) {
  if (!overview) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <p className="text-gray-900 font-medium">We couldn&apos;t load marketing data.</p>
        <p className="mt-1 text-sm text-gray-500">Check your connection and try again.</p>
        <button
          onClick={onReload}
          className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const hasRevenue = (overview.totalRevenue || 0) > 0;
  const hasSpend = (overview.totalCost || 0) > 0;
  const overviewRoiLabel = hasSpend && Number.isFinite(overview.roi)
    ? `${overview.roi.toFixed(1)}x`
    : hasRevenue
      ? 'Organic'
      : '—';

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`$${(overview.totalRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
        />
        <MetricCard
          title="Marketing ROI"
          value={overviewRoiLabel}
          icon={LineChart}
        />
        <MetricCard
          title="Active Customers"
          value={(overview.activeCustomers || 0).toLocaleString()}
          icon={Users}
        />
        <MetricCard
          title="Total Spend"
          value={`$${(overview.totalCost || 0).toLocaleString()}`}
          icon={CreditCard}
        />
      </div>

      {/* Channel Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Channel Performance</h3>
          <div className="space-y-4">
            {overview.topPerformingChannels?.filter(channel => channel && channel.channel)?.map((channel, index) => {
              const hasRevenue = (channel.revenue || 0) > 0;
              const hasCost = (channel.cost || 0) > 0;
              const roiLabel = !hasRevenue && !hasCost
                ? '—'
                : !hasCost && hasRevenue
                  ? 'Organic'
                  : Number.isFinite(channel.roi)
                    ? `${channel.roi.toFixed(1)}x ROI`
                    : '—';

              return (
                <div key={channel.channel} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      !hasRevenue ? 'bg-gray-300' :
                      index === 0 ? 'bg-green-500' :
                      index === 1 ? 'bg-blue-500' :
                      index === 2 ? 'bg-yellow-500' : 'bg-gray-400'
                    }`}></div>
                    <span className="font-medium capitalize">{channel.channel}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${(channel.revenue || 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-500">{roiLabel}</div>
                  </div>
                </div>
              );
            }) || <div className="text-gray-500">No channel data available</div>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Campaign Activity</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" aria-hidden="true" />Email Campaigns</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance?.email?.sent || 0} sent</div>
                {onSelectTab ? (
                  <button
                    type="button"
                    onClick={() => onSelectTab('newsletter')}
                    className="text-sm text-gray-500 underline hover:text-gray-900"
                  >
                    Open newsletters
                  </button>
                ) : (
                  <Link href="/admin?tab=newsletter" className="text-sm text-gray-500 underline hover:text-gray-900">
                    Open newsletters
                  </Link>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="inline-flex items-center gap-2"><Smartphone className="h-4 w-4" aria-hidden="true" />Social Media</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance?.social?.posts || 0} posts</div>
                <div className="text-sm text-gray-500">
                  {(overview.campaignPerformance?.social?.reach || 0).toLocaleString()} reach
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="inline-flex items-center gap-2"><Target className="h-4 w-4" aria-hidden="true" />Ad spend log</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance?.ads?.conversions || 0} conversions</div>
                <div className="text-sm text-gray-500">
                  {(overview.campaignPerformance?.ads?.roas || 0).toFixed(1)}x recorded ROAS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Campaigns Tab Component
function CampaignsTab({ onSelectTab }: { onSelectTab?: (tab: string) => void }) {
  const [campaigns, setCampaigns] = useState<CampaignsResponse>({ social: [], ads: [] });
  const [campaignType, setCampaignType] = useState<'social' | 'ad'>('social');
  const [draft, setDraft] = useState<Record<string, any>>({
    name: '',
    platform: 'instagram',
    content: '',
    mediaUrls: [] as string[],
    budgetAmount: 0,
    scheduledAt: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareAssist, setShareAssist] = useState<{
    campaignId: string;
    assist: ShareAssistPayload;
    publishError?: string;
  } | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await fetch('/api/marketing/campaigns');
      if (!response.ok) {
        throw new Error('Failed to load campaigns');
      }
      const data = await response.json();
      setCampaigns(data);
      setError(null);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      setError(error instanceof Error ? error.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

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

  const saveCampaign = async () => {
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
      await loadCampaigns();
      setMessage('Campaign saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save campaign');
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
      await loadCampaigns();
      if (data.campaign?.publishAssist) {
        setShareAssist({
          campaignId: id,
          assist: data.campaign.publishAssist,
          publishError: typeof data.campaign.publishError === 'string' ? data.campaign.publishError : undefined,
        });
        setMessage(
          data.campaign.publishError
            ? 'Auto-publish could not complete. Use the manual post assist below.'
            : 'Caption and links are ready below — post on the platform, then click Mark as posted.'
        );
      } else if (type === 'ad') {
        setMessage('Ad log marked active. Record results after you run the campaign in the ads manager.');
      } else {
        setMessage('Campaign status updated.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to run campaign');
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
      await loadCampaigns();
      setMessage('Campaign deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete campaign');
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
      await loadCampaigns();
      setMessage('Ad results saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save ad results');
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
      await loadCampaigns();
      setMessage('Social post marked as published.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to mark post as published');
    }
  };

  const markSocialPosted = async (campaign: CampaignSummary) => {
    await markSocialPostedById(campaign.id);
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</div>}

      <PromoCodesPanel />

      <MarketQrCard onSelectTab={onSelectTab} />

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Create Campaign</h3>
            <p className="text-sm text-gray-600">
              Social opens a copy-and-post assist (or auto-publishes when configured). Ad entries are a spend log only — they do not buy ads on Google or Meta. Email subscribers get newsletters from the{' '}
              {onSelectTab ? (
                <button
                  type="button"
                  onClick={() => onSelectTab('newsletter')}
                  className="font-medium text-gray-900 underline"
                >
                  Newsletter tab
                </button>
              ) : (
                <Link href="/admin?tab=newsletter" className="font-medium text-gray-900 underline">Newsletter tab</Link>
              )}.
            </p>
          </div>
          <select
            value={campaignType}
            onChange={(event) => {
              const nextType = event.target.value as 'social' | 'ad';
              setCampaignType(nextType);
              if (nextType === 'social' && draft.platform === 'google') {
                setDraft((current) => ({ ...current, platform: 'instagram' }));
              }
            }}
            className="h-10 rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
          >
            <option value="social">Social post</option>
            <option value="ad">Ad spend log</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Name
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Platform
            <select value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value })} className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal">
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
            Schedule
            <input type="datetime-local" value={draft.scheduledAt} onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })} className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal" />
          </label>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Content
            <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} rows={5} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
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
          <button type="button" onClick={() => void saveCampaign()} className="rounded bg-gray-900 px-4 py-2 text-white">Save</button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Active Campaigns</h3>
      </div>

      {shareAssist && (
        <ShareAssistPanel
          assist={shareAssist.assist}
          publishError={shareAssist.publishError}
          onMarkPosted={() => void markSocialPostedById(shareAssist.campaignId)}
          onDismiss={() => setShareAssist(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CampaignSection
          title="Social Media"
          icon={Smartphone}
          campaigns={campaigns.social}
          onRun={(campaign) => runCampaign(campaign.id, campaign.type)}
          onDelete={(campaign) => deleteCampaign(campaign.id)}
          onMarkPosted={markSocialPosted}
        />

        <CampaignSection
          title="Ad spend log"
          icon={Megaphone}
          campaigns={campaigns.ads}
          onRun={(campaign) => runCampaign(campaign.id, campaign.type)}
          onDelete={(campaign) => deleteCampaign(campaign.id)}
          onSaveActuals={saveAdActuals}
        />
        <p className="text-xs text-gray-500 lg:col-span-2">
          Ad spend log records budget and results you enter by hand. Use “Open ads manager” links to run campaigns on the platform itself.
        </p>
      </div>
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
              Auto-publish could not finish ({publishError}) — you can still post manually below.
            </p>
          )}
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {assist.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
          </ul>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={copyCaption} className="rounded bg-amber-900 px-3 py-2 text-white hover:bg-amber-800">
            {copied ? 'Copied!' : 'Copy caption'}
          </button>
          <button type="button" onClick={onDismiss} className="rounded border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900 hover:bg-amber-100">
            Close
          </button>
        </div>
      </div>
      <div className="mt-4 rounded border border-amber-200 bg-white p-3 whitespace-pre-wrap">{assist.caption}</div>
      {safeMediaUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {safeMediaUrls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="rounded border border-amber-300 bg-white px-3 py-1 text-amber-900">Open media</a>)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {safeLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded bg-gray-900 px-3 py-2 text-white hover:bg-gray-800">{link.label}</a>)}
        <button
          type="button"
          onClick={onMarkPosted}
          className="rounded border border-emerald-700 bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800"
        >
          Mark as posted
        </button>
      </div>
    </div>
  );
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

function PromoCodesPanel() {
  const [promoCodes, setPromoCodes] = useState<PromoCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '10',
    usageLimit: '',
    expiresAt: '',
  });

  async function loadPromoCodes() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/promo-codes');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load promo codes');
      setPromoCodes(data.promoCodes || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPromoCodes();
  }, []);

  async function createPromoCode() {
    setMessage(null);
    try {
      const response = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: draft.code,
          discountType: draft.discountType,
          discountValue: Number(draft.discountValue),
          usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
          expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create promo code');
      setDraft({ code: '', discountType: 'percentage', discountValue: '10', usageLimit: '', expiresAt: '' });
      setMessage('Promo code created. Collectors can enter it at checkout.');
      await loadPromoCodes();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create promo code');
    }
  }

  async function assignCartRecoveryPromo(code: string) {
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { CART_RECOVERY_PROMO_CODE: code } }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Failed to save cart recovery promo');
      return;
    }
    setMessage(`Saved ${code} as your cart recovery promo code. Make sure Cart recovery is enabled under Newsletter → Automations.`);
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
      setMessage(`Promo code ${promo.code} deleted.`);
      await loadPromoCodes();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete promo code');
    }
  }

  return (
    <section className="rounded-lg border bg-white p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Promo codes</h3>
        <p className="text-sm text-gray-600">Create a discount code collectors can enter at checkout.</p>
      </div>
      {message && <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded p-3">{message}</p>}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <label className="text-sm font-medium text-gray-700">
          Code
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal" placeholder="SPRING10" />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Type
          <select value={draft.discountType} onChange={(e) => setDraft({ ...draft, discountType: e.target.value as 'percentage' | 'fixed' })} className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal">
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
          <input type="datetime-local" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal" />
        </label>
      </div>
      <button type="button" onClick={createPromoCode} className="rounded bg-gray-900 px-4 py-2 text-white text-sm">Create promo code</button>
      {loading ? (
        <p className="text-sm text-gray-500">Loading promo codes...</p>
      ) : promoCodes.length === 0 ? (
        <p className="text-sm text-gray-500">No promo codes yet.</p>
      ) : (
        <ul className="divide-y border rounded-md">
          {promoCodes.map((promo) => (
            <li key={promo.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <span className="font-semibold">{promo.code}</span>
                <span className="text-gray-600"> · {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `$${promo.discountValue}`}</span>
                <span className="text-gray-500"> · used {promo.usageCount}{promo.usageLimit ? `/${promo.usageLimit}` : ''}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(promo.code);
                    setCopiedCode(promo.code);
                    window.setTimeout(() => setCopiedCode((current) => (current === promo.code ? null : current)), 2000);
                  }}
                  className="rounded border px-2 py-1 hover:bg-gray-50"
                >
                  {copiedCode === promo.code ? 'Copied!' : 'Copy'}
                </button>
                <button type="button" onClick={() => assignCartRecoveryPromo(promo.code)} className="rounded border px-2 py-1 hover:bg-gray-50">Use for cart recovery</button>
                {promo.usageCount === 0 && (
                  <button
                    type="button"
                    onClick={() => void deletePromoCode(promo)}
                    className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Customer Journey & Automation Summary (deduplicated against Analytics tab)
function PerformanceInsightsRow({
  overview,
  onSelectTab,
}: {
  overview: MarketingOverview | null;
  onSelectTab?: (tab: string) => void;
}) {
  const journey = overview?.analytics?.journey || [];
  const maxVisitors = Math.max(1, ...journey.map(item => item.visitors));
  const automation = overview?.automation;

  const automationRows: Array<{ name: string; detail: string; active: boolean; statusLabel?: string; editHref?: string }> = [
    {
      name: 'Welcome email',
      detail: `${automation?.email.welcomeInstantSent ?? automation?.email.welcomeSent ?? 0} sent · Instant on newsletter signup`,
      active: automation?.email.welcomeEnabled !== false,
      editHref: `/admin?tab=newsletter&automation=${AUTOMATION_EMAIL_IDS.newsletterWelcome}`,
    },
    {
      name: 'Day-3 studio follow-up',
      detail: `${automation?.email.welcomeFollowupSent ?? 0} sent · 3 days after signup`,
      active: Boolean(automation?.email.welcomeSeriesEnabled),
      editHref: `/admin?tab=newsletter&automation=${AUTOMATION_EMAIL_IDS.newsletterWelcomeFollowup}`,
    },
    {
      name: 'Collector win-back',
      detail: `${automation?.email.winbackSent || 0} sent · ${automation?.email.winbackInactiveDays || 45}-day quiet window`,
      active: Boolean(automation?.email.winbackEnabled),
      editHref: `/admin?tab=newsletter&automation=${AUTOMATION_EMAIL_IDS.collectorWinback}`,
    },
    {
      name: 'Cart recovery',
      detail: `${automation?.email.cartAbandonment || 0} recovery emails triggered`,
      active: Boolean(automation?.email.cartEnabled),
      editHref: `/admin?tab=newsletter&automation=${AUTOMATION_EMAIL_IDS.cartRecovery}`,
    },
    {
      name: automation?.social.autoPublish
        ? `Social auto-publish (${automation.social.provider === 'ayrshare' ? 'Ayrshare' : 'Meta'})`
        : 'Social publishing (Assist)',
      detail: automation?.social.autoPublish
        ? `${automation?.social.posts || 0} social posts recorded`
        : `${automation?.social.posts || 0} posts drafted · Copy & open platform (no API keys required)`,
      active: Boolean(automation?.social.autoPublish) || (automation?.social.posts || 0) > 0,
      statusLabel: automation?.social.autoPublish ? 'Auto' : 'Assist',
      editHref: '/admin?tab=settings#setting-SOCIAL_PROVIDER',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Customer Journey</h3>
          {onSelectTab ? (
            <button
              type="button"
              onClick={() => onSelectTab('analytics')}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              Open full Analytics →
            </button>
          ) : (
            <Link href="/admin?tab=analytics" className="text-xs font-medium text-blue-700 hover:underline">
              Open full Analytics →
            </Link>
          )}
        </div>
        <div className="space-y-4">
          {journey.length === 0 ? (
            <div className="text-sm text-gray-500">No journey data available yet.</div>
          ) : journey.map(item => (
            <JourneyStep
              key={item.step}
              step={item.step}
              percentage={(item.visitors / maxVisitors) * 100}
              count={item.visitors}
            />
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Automations</h3>
          <Link href="/admin?tab=newsletter&view=automations" className="text-xs font-medium text-blue-700 hover:underline">
            Edit automation emails →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {automationRows.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                {row.editHref ? (
                  <Link href={row.editHref} className="text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline">
                    {row.name}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-gray-900">{row.name}</p>
                )}
                <p className="text-xs text-gray-500">{row.detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.editHref && (
                  <Link href={row.editHref} className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline">
                    Edit
                  </Link>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    row.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {'statusLabel' in row && row.statusLabel ? row.statusLabel : row.active ? 'On' : 'Off'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function MetricCard({ title, value, change, changeType, icon }: {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: LucideIcon;
}) {
  const Icon = icon;
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <Icon className="h-7 w-7 text-gray-500" aria-hidden="true" />
      </div>
      {change ? (
        <div className={`mt-2 text-sm ${
          changeType === 'negative' ? 'text-red-600' : 'text-green-600'
        }`}>
          {change}
        </div>
      ) : null}
    </div>
  );
}

function DateRangeSelector({ value, onChange }: {
  value: string;
  onChange: (value: '7d' | '30d' | '90d' | '1y') => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as any)}
      className="h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-normal bg-white"
    >
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
      <option value="1y">Last year</option>
    </select>
  );
}

function ChannelFilter({ selected, onChange }: {
  selected: string[];
  onChange: (channels: string[]) => void;
}) {
  const channels = ['email', 'social', 'ads'];
  
  return (
    <div className="flex space-x-2">
      {channels.map((channel) => (
        <button
          key={channel}
          onClick={() => {
            const newSelected = selected.includes(channel)
              ? selected.filter(c => c !== channel)
              : [...selected, channel];
            onChange(newSelected);
          }}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            selected.includes(channel)
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {channel.charAt(0).toUpperCase() + channel.slice(1)}
        </button>
      ))}
    </div>
  );
}

function CampaignSection({ title, icon, campaigns, onRun, onDelete, onSaveActuals, onMarkPosted }: {
  title: string;
  icon: LucideIcon;
  campaigns: CampaignSummary[];
  onRun?: (campaign: CampaignSummary) => void;
  onDelete?: (campaign: CampaignSummary) => void;
  onSaveActuals?: (campaign: CampaignSummary, actuals: { impressions: number; clicks: number; conversions: number; cost: number; roas: number }) => void;
  onMarkPosted?: (campaign: CampaignSummary) => void;
}) {
  const [adActuals, setAdActuals] = useState<Record<string, { impressions: string; clicks: string; conversions: string; cost: string; roas: string }>>({});
  const Icon = icon;

  const runLabel = (campaign: CampaignSummary) => {
    if (campaign.type === 'social') return 'Prepare post';
    return 'Mark active';
  };

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
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center mb-4">
        <Icon className="mr-2 h-5 w-5 text-gray-500" aria-hidden="true" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">
        {campaigns.length === 0 ? (
          <div className="text-sm text-gray-500">No campaign data available.</div>
        ) : campaigns.map((campaign) => {
          const badge = statusPresentation(campaign.status, campaign.type);
          return (
          <div key={campaign.id} className="border-l-4 border-blue-500 pl-3">
            <div className="font-medium">{campaign.name}</div>
            <div className="text-sm text-gray-600">{campaign.performance}</div>
            <div className={`text-xs px-2 py-1 rounded inline-block mt-1 font-medium ${badge.className}`}>
              {badge.label}
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
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
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
                  <button
                    type="button"
                    onClick={() => onSaveActuals(campaign, {
                      impressions: Number(values.impressions || 0),
                      clicks: Number(values.clicks || 0),
                      conversions: Number(values.conversions || 0),
                      cost: Number(values.cost || 0),
                      roas: Number(values.roas || 0),
                    })}
                    className="sm:col-span-2 text-left text-xs font-medium text-blue-700 hover:text-blue-800"
                  >
                    Save ad results
                  </button>
                  {managerUrl && (
                    <a href={managerUrl} target="_blank" rel="noreferrer" className="sm:col-span-2 text-xs font-medium text-gray-700 hover:text-gray-900">
                      Open ads manager
                    </a>
                  )}
                </div>
              );
            })()}
            <div className="mt-2 flex gap-2">
              {onRun && <button type="button" onClick={() => onRun(campaign)} className="text-xs font-medium text-blue-700 hover:text-blue-800">{runLabel(campaign)}</button>}
              {campaign.type === 'social' && campaign.status !== 'published' && onMarkPosted && <button type="button" onClick={() => onMarkPosted(campaign)} className="text-xs font-medium text-green-700 hover:text-green-800">Mark as posted</button>}
              {onDelete && <button type="button" onClick={() => onDelete(campaign)} className="text-xs font-medium text-red-700 hover:text-red-800">Delete</button>}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function JourneyStep({ step, percentage, count }: {
  step: string;
  percentage: number;
  count: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{step}</span>
        <span>
          {count.toLocaleString()} {count === 1 ? 'visitor' : 'visitors'}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}