// Unified Marketing Dashboard System
'use client';

import React, { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, Bot, CreditCard, DollarSign, LineChart, Mail, Megaphone, Smartphone, Target, Users } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';

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
    email: { active: number; total: number; sent: number; cartAbandonment: number; postPurchase: number };
    social: { active: number; total: number; posts: number };
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
  type: 'email' | 'social' | 'ad';
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
  email: CampaignSummary[];
  social: CampaignSummary[];
  ads: CampaignSummary[];
}

export function UnifiedMarketingDashboard() {
  const [overview, setOverview] = useState<MarketingOverview | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: '30d',
    channels: ['email', 'social', 'ads'],
    campaigns: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'automation' | 'analytics'>('overview');

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div data-testid="marketing-dashboard" className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Marketing Dashboard</h1>
        <div className="flex space-x-4">
          <DateRangeSelector value={filters.dateRange} onChange={(range) => 
            setFilters({ ...filters, dateRange: range })
          } />
          <ChannelFilter 
            selected={filters.channels} 
            onChange={(channels) => setFilters({ ...filters, channels })}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', Icon: BarChart3 },
            { key: 'campaigns', label: 'Campaigns', Icon: Target },
            { key: 'automation', label: 'Automation', Icon: Bot },
            { key: 'analytics', label: 'Analytics', Icon: LineChart }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
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
      {activeTab === 'overview' && <OverviewTab overview={overview} onReload={loadDashboardData} />}
      {activeTab === 'campaigns' && <CampaignsTab />}
      {activeTab === 'automation' && <AutomationTab overview={overview} />}
      {activeTab === 'analytics' && <AnalyticsTab overview={overview} />}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ overview, onReload }: { overview: MarketingOverview | null; onReload: () => void }) {
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

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`$${(overview.totalRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
        />
        <MetricCard
          title="Marketing ROI"
          value={`${(overview.roi || 0).toFixed(1)}x`}
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
            {overview.topPerformingChannels?.filter(channel => channel && channel.channel)?.map((channel, index) => (
              <div key={channel.channel} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    index === 0 ? 'bg-green-500' : 
                    index === 1 ? 'bg-blue-500' : 
                    index === 2 ? 'bg-yellow-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="font-medium capitalize">{channel.channel}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">${(channel.revenue || 0).toLocaleString()}</div>
                  <div className="text-sm text-gray-500">
                    {channel.roi !== null && channel.roi !== undefined ? 
                      (isFinite(channel.roi) ? channel.roi.toFixed(1) : '∞') : '0.0'
                    }x ROI
                  </div>
                </div>
              </div>
            )) || <div className="text-gray-500">No channel data available</div>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Campaign Activity</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" aria-hidden="true" />Email Campaigns</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance?.email?.sent || 0} sent</div>
                <div className="text-sm text-gray-500">
                  {overview.campaignPerformance?.email?.sent > 0 ? 
                    ((overview.campaignPerformance.email.opened / overview.campaignPerformance.email.sent) * 100).toFixed(1) : 
                    '0.0'
                  }% open rate
                </div>
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
              <span className="inline-flex items-center gap-2"><Target className="h-4 w-4" aria-hidden="true" />Paid Ads</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance?.ads?.conversions || 0} conversions</div>
                <div className="text-sm text-gray-500">
                  {(overview.campaignPerformance?.ads?.roas || 0).toFixed(1)}x ROAS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Marketing Activity</h3>
        <RecentActivityFeed overview={overview} />
      </div>
    </div>
  );
}

// Campaigns Tab Component
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<CampaignsResponse>({ email: [], social: [], ads: [] });
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([{ id: 'all', name: 'All customers' }]);
  const [campaignType, setCampaignType] = useState<'email' | 'social' | 'ad'>('email');
  const [draft, setDraft] = useState<Record<string, any>>({
    name: '',
    subject: '',
    htmlContent: '<p></p>',
    segments: ['all'],
    platform: 'instagram',
    content: '',
    mediaUrls: [] as string[],
    budgetAmount: 0,
    scheduledAt: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareAssist, setShareAssist] = useState<ShareAssistPayload | null>(null);

  useEffect(() => {
    loadCampaigns();
    loadSegments();
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

  const loadSegments = async () => {
    try {
      const response = await fetch('/api/analytics/customers');
      const data = await response.json();
      const loadedSegments = Array.isArray(data.segments) ? data.segments : [];
      setSegments([{ id: 'all', name: 'All customers' }, ...loadedSegments]);
    } catch {
      setSegments([{ id: 'all', name: 'All customers' }]);
    }
  };

  const resetDraft = () => setDraft({
    name: '',
    subject: '',
    htmlContent: '<p></p>',
    segments: ['all'],
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

  const saveCampaign = async (sendAfterSave = false) => {
    setMessage(null);
    setShareAssist(null);
    const payload = {
      ...draft,
      type: campaignType,
      segments: Array.isArray(draft.segments) ? draft.segments : ['all'],
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

      if (sendAfterSave && data.campaign?.id) {
        await runCampaign(data.campaign.id, campaignType, false);
      }

      resetDraft();
      await loadCampaigns();
      setMessage(sendAfterSave ? 'Campaign saved and sent.' : 'Campaign saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save campaign');
    }
  };

  const runCampaign = async (id: string, type: 'email' | 'social' | 'ad', reload = true) => {
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
      if (reload) await loadCampaigns();
      if (data.campaign?.publishAssist) {
        setShareAssist(data.campaign.publishAssist);
        setMessage('Use the publish assist panel to complete this social post.');
      } else {
        setMessage(type === 'email' ? 'Email campaign sent.' : 'Campaign status updated.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to run campaign');
    }
  };

  const deleteCampaign = async (id: string, type: 'email' | 'social' | 'ad') => {
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

  const markSocialPosted = async (campaign: CampaignSummary) => {
    setMessage(null);
    setShareAssist(null);
    try {
      const response = await fetch(`/api/marketing/campaigns/${campaign.id}`, {
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
      {shareAssist && <ShareAssistPanel assist={shareAssist} />}

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Create Campaign</h2>
            <p className="text-sm text-gray-600">Create email, social, or ad records without touching code.</p>
          </div>
          <select value={campaignType} onChange={(event) => setCampaignType(event.target.value as any)} className="rounded-md border border-gray-300 px-3 py-2">
            <option value="email">Email</option>
            <option value="social">Social</option>
            <option value="ad">Ad</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Name
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          {campaignType === 'email' && (
            <label className="text-sm font-medium text-gray-700">
              Subject
              <input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
            </label>
          )}
          {campaignType !== 'email' && (
            <label className="text-sm font-medium text-gray-700">
              Platform
              <select value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="google">Google</option>
                <option value="pinterest">Pinterest</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </label>
          )}
          {campaignType === 'email' && (
            <label className="text-sm font-medium text-gray-700">
              Audience
              <select value={draft.segments?.[0] || 'all'} onChange={(event) => setDraft({ ...draft, segments: [event.target.value] })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
                {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
              </select>
            </label>
          )}
          {campaignType === 'ad' && (
            <label className="text-sm font-medium text-gray-700">
              Budget
              <input type="number" min="0" value={draft.budgetAmount} onChange={(event) => setDraft({ ...draft, budgetAmount: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
            </label>
          )}
          <label className="text-sm font-medium text-gray-700">
            Schedule
            <input type="datetime-local" value={draft.scheduledAt} onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
        </div>

        {campaignType === 'email' ? (
          <RichTextEditor value={draft.htmlContent} onChange={(htmlContent) => setDraft((current) => ({ ...current, htmlContent }))} />
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Content
              <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} rows={5} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
            </label>
            {campaignType === 'social' && (
              <label className="block text-sm font-medium text-gray-700">
                Media URLs
                <textarea value={Array.isArray(draft.mediaUrls) ? draft.mediaUrls.join('\n') : draft.mediaUrls || ''} onChange={(event) => setDraft({ ...draft, mediaUrls: parseListValue(event.target.value) })} rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" placeholder="One image or video URL per line" />
              </label>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => saveCampaign(false)} className="rounded bg-gray-900 px-4 py-2 text-white">Save</button>
          {campaignType === 'email' && <button type="button" onClick={() => saveCampaign(true)} className="rounded bg-blue-600 px-4 py-2 text-white">Send Now</button>}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Active Campaigns</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CampaignSection
          title="Email Marketing"
          icon={Mail}
          campaigns={campaigns.email}
          onRun={(campaign) => runCampaign(campaign.id, campaign.type)}
          onDelete={(campaign) => deleteCampaign(campaign.id, campaign.type)}
        />

        <CampaignSection
          title="Social Media"
          icon={Smartphone}
          campaigns={campaigns.social}
          onRun={(campaign) => runCampaign(campaign.id, campaign.type)}
          onDelete={(campaign) => deleteCampaign(campaign.id, campaign.type)}
          onMarkPosted={markSocialPosted}
        />

        <CampaignSection
          title="Paid Advertising"
          icon={Megaphone}
          campaigns={campaigns.ads}
          onRun={(campaign) => runCampaign(campaign.id, campaign.type)}
          onDelete={(campaign) => deleteCampaign(campaign.id, campaign.type)}
          onSaveActuals={saveAdActuals}
        />
      </div>
    </div>
  );
}

function ShareAssistPanel({ assist }: { assist: ShareAssistPayload }) {
  const copyCaption = async () => {
    await navigator.clipboard?.writeText(assist.caption);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold">{assist.label}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {assist.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
          </ul>
        </div>
        <button type="button" onClick={copyCaption} className="rounded bg-amber-900 px-3 py-2 text-white">Copy caption</button>
      </div>
      <div className="mt-4 rounded border border-amber-200 bg-white p-3 whitespace-pre-wrap">{assist.caption}</div>
      {assist.mediaUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {assist.mediaUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded border border-amber-300 bg-white px-3 py-1 text-amber-900">Open media</a>)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {assist.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="rounded bg-gray-900 px-3 py-2 text-white">{link.label}</a>)}
      </div>
    </div>
  );
}

// Automation Tab Component
function AutomationTab({ overview }: { overview: MarketingOverview | null }) {
  const automation = overview?.automation;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Automation */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold"><Mail className="h-5 w-5" aria-hidden="true" />Email Automation</h3>
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              {automation?.email.active || 0} Active
            </span>
          </div>
          <div className="space-y-3">
            <AutomationRule
              name="Welcome Series"
              trigger="New user signup"
              status={(automation?.email.sent || 0) > 0 ? 'active' : 'ready'}
              performance={`${automation?.email.sent || 0} emails sent`}
            />
            <AutomationRule
              name="Cart Abandonment"
              trigger="Cart inactive 1 hour"
              status={(automation?.email.cartAbandonment || 0) > 0 ? 'active' : 'ready'}
              performance={`${automation?.email.cartAbandonment || 0} cart signals captured`}
            />
            <AutomationRule
              name="Post-Purchase Follow-up"
              trigger="Order completed"
              status={(automation?.email.postPurchase || 0) > 0 ? 'active' : 'ready'}
              performance={`${automation?.email.postPurchase || 0} follow-up events`}
            />
          </div>
        </div>

        {/* Social Media Automation */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold"><Smartphone className="h-5 w-5" aria-hidden="true" />Social Automation</h3>
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              {automation?.social.active || 0} Active
            </span>
          </div>
          <div className="space-y-3">
            <AutomationRule
              name="Product Showcase"
              trigger="New product added"
              status={(automation?.social.posts || 0) > 0 ? 'active' : 'ready'}
              performance={`${automation?.social.posts || 0} posts recorded`}
            />
          </div>
        </div>
      </div>

      {/* Automation Performance */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Automation Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{automation?.email.sent || 0}</div>
            <div className="text-sm text-gray-500">Emails Sent</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{automation?.social.posts || 0}</div>
            <div className="text-sm text-gray-500">Social Posts Recorded</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{(automation?.email.cartAbandonment || 0) + (automation?.email.postPurchase || 0)}</div>
            <div className="text-sm text-gray-500">Automation Signals</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Analytics Tab Component
function AnalyticsTab({ overview }: { overview: MarketingOverview | null }) {
  const journey = overview?.analytics?.journey || [];
  const maxVisitors = Math.max(1, ...journey.map(item => item.visitors));
  const metrics = overview?.analytics?.metrics;
  const topChannels = overview?.topPerformingChannels || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Journey Analytics */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Customer Journey</h3>
          <div className="space-y-4">
            {journey.length === 0 ? (
              <div className="text-sm text-gray-500">No journey data available yet.</div>
            ) : journey.map(item => (
              <JourneyStep key={item.step} step={item.step} percentage={(item.visitors / maxVisitors) * 100} visitors={item.visitors.toLocaleString()} />
            ))}
          </div>
        </div>

        {/* Channel Attribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Revenue Attribution</h3>
          <div className="space-y-3">
            {topChannels.length === 0 ? (
              <div className="text-sm text-gray-500">No attribution data available yet.</div>
            ) : topChannels.map(channel => (
              <AttributionBar key={channel.channel} channel={channel.channel} percentage={overview?.totalRevenue ? (channel.revenue / overview.totalRevenue) * 100 : 0} revenue={`$${channel.revenue.toLocaleString()}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Analytics */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Advanced Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnalyticsMetric
            title="Customer Lifetime Value"
            value={`$${(metrics?.averageLifetimeValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            trend={`${metrics?.activeProfiles || 0} profiles`}
            description="Average CLV across all segments"
          />
          <AnalyticsMetric
            title="Purchases"
            value={`${metrics?.purchaseCount || 0}`}
            trend="orders"
            description="Paid orders in this period"
          />
          <AnalyticsMetric
            title="Channel Revenue"
            value={`$${(overview?.totalRevenue || 0).toLocaleString()}`}
            trend={`${topChannels.length} channels`}
            description="Revenue captured in selected period"
          />
          <AnalyticsMetric
            title="Engagement Score"
            value={`${Math.round(metrics?.averageEngagementScore || 0)}`}
            trend="average"
            description="Average customer engagement"
          />
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
      className="border border-gray-300 rounded-md px-3 py-2 bg-white"
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
    if (campaign.type === 'email') return 'Send';
    if (campaign.type === 'social') return 'Prepare post';
    return 'Mark active';
  };

  const adManagerUrl = (campaign: CampaignSummary): string | null => {
    const platform = String(campaign.content?.platform || '').toLowerCase();
    if (platform === 'google') return 'https://ads.google.com/aw/campaigns';
    if (platform === 'facebook' || platform === 'instagram') return 'https://business.facebook.com/adsmanager/manage/campaigns';
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
        ) : campaigns.map((campaign) => (
          <div key={campaign.id} className="border-l-4 border-blue-500 pl-3">
            <div className="font-medium">{campaign.name}</div>
            <div className="text-sm text-gray-600">{campaign.performance}</div>
            <div className={`text-xs px-2 py-1 rounded inline-block mt-1 ${
              campaign.status === 'active' ? 'bg-green-100 text-green-800' :
              campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {campaign.status}
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
                  <label className="font-medium text-gray-700">
                    Impressions
                    <input
                      type="number"
                      min="0"
                      value={values.impressions}
                      onChange={(event) => setAdActuals((current) => ({ ...current, [campaign.id]: { ...values, impressions: event.target.value } }))}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                  <label className="font-medium text-gray-700">
                    Clicks
                    <input
                      type="number"
                      min="0"
                      value={values.clicks}
                      onChange={(event) => setAdActuals((current) => ({ ...current, [campaign.id]: { ...values, clicks: event.target.value } }))}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                  <label className="font-medium text-gray-700">
                    Conversions
                    <input
                      type="number"
                      min="0"
                      value={values.conversions}
                      onChange={(event) => setAdActuals((current) => ({ ...current, [campaign.id]: { ...values, conversions: event.target.value } }))}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                  <label className="font-medium text-gray-700">
                    Actual cost
                    <input
                      type="number"
                      min="0"
                      value={values.cost}
                      onChange={(event) => setAdActuals((current) => ({ ...current, [campaign.id]: { ...values, cost: event.target.value } }))}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                  <label className="font-medium text-gray-700">
                    ROAS
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.roas}
                      onChange={(event) => setAdActuals((current) => ({ ...current, [campaign.id]: { ...values, roas: event.target.value } }))}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
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
        ))}
      </div>
    </div>
  );
}

function AutomationRule({ name, trigger, status, performance }: {
  name: string;
  trigger: string;
  status: string;
  performance: string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{name}</div>
        <div className={`text-xs px-2 py-1 rounded ${
          status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {status}
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-1">Trigger: {trigger}</div>
      <div className="text-xs text-blue-600">{performance}</div>
    </div>
  );
}

function JourneyStep({ step, percentage, visitors }: {
  step: string;
  percentage: number;
  visitors: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{step}</span>
        <span>{visitors} visitors</span>
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

function AttributionBar({ channel, percentage, revenue }: {
  channel: string;
  percentage: number;
  revenue: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{channel}</span>
        <span>{revenue}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

function AnalyticsMetric({ title, value, trend, description }: {
  title: string;
  value: string;
  trend: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className={`text-xs ${trend.startsWith('+') ? 'text-green-600' : trend.startsWith('-') ? 'text-red-600' : 'text-gray-500'}`}>
        {trend}
      </div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </div>
  );
}

function RecentActivityFeed({ overview }: { overview: MarketingOverview | null }) {
  const activities = [
    { label: `${overview?.campaignPerformance?.email?.sent || 0} email events sent`, type: 'email' },
    { label: `${overview?.campaignPerformance?.social?.posts || 0} social posts recorded`, type: 'social' },
    { label: `${overview?.campaignPerformance?.ads?.conversions || 0} ad conversions recorded`, type: 'ads' },
    { label: `$${(overview?.totalRevenue || 0).toLocaleString()} paid order revenue`, type: 'revenue' }
  ];

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${
            activity.type === 'email' ? 'bg-blue-500' :
            activity.type === 'social' ? 'bg-purple-500' :
            activity.type === 'ads' ? 'bg-green-500' :
            'bg-gray-500'
          }`}></div>
          <div className="flex-1">
            <div className="text-sm">{activity.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}