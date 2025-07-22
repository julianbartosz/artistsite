// Unified Marketing Dashboard System
'use client';

import React, { useState, useEffect } from 'react';
import { CRMIntegration } from '@/lib/crm/crm-integration';
import { SocialMediaAutomation } from '@/lib/social/social-automation';
import { AdPlatformIntegration } from '@/lib/ads/ad-platform-integration';
import { CustomerInsights } from '@/lib/analytics/customer-insights';
import { EmailSequences } from '@/lib/marketing/email-sequences';

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
}

interface DashboardFilters {
  dateRange: '7d' | '30d' | '90d' | '1y';
  channels: string[];
  campaigns: string[];
}

export function UnifiedMarketingDashboard() {
  const [overview, setOverview] = useState<MarketingOverview | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: '30d',
    channels: ['email', 'social', 'ads', 'crm'],
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
      const data = await fetch('/api/marketing/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });
      const overview = await data.json();
      setOverview(overview);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
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
            { key: 'overview', label: 'Overview', icon: '📊' },
            { key: 'campaigns', label: 'Campaigns', icon: '🎯' },
            { key: 'automation', label: 'Automation', icon: '🤖' },
            { key: 'analytics', label: 'Analytics', icon: '📈' }
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
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab overview={overview} />}
      {activeTab === 'campaigns' && <CampaignsTab />}
      {activeTab === 'automation' && <AutomationTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ overview }: { overview: MarketingOverview | null }) {
  if (!overview) return <div>No data available</div>;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`$${overview.totalRevenue.toLocaleString()}`}
          change="+15.3%"
          changeType="positive"
          icon="💰"
        />
        <MetricCard
          title="Marketing ROI"
          value={`${overview.roi.toFixed(1)}x`}
          change="+8.2%"
          changeType="positive"
          icon="📈"
        />
        <MetricCard
          title="Active Customers"
          value={overview.activeCustomers.toLocaleString()}
          change="+12.5%"
          changeType="positive"
          icon="👥"
        />
        <MetricCard
          title="Total Spend"
          value={`$${overview.totalCost.toLocaleString()}`}
          change="-3.1%"
          changeType="negative"
          icon="💳"
        />
      </div>

      {/* Channel Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Channel Performance</h3>
          <div className="space-y-4">
            {overview.topPerformingChannels.map((channel, index) => (
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
                  <div className="font-semibold">${channel.revenue.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">{channel.roi.toFixed(1)}x ROI</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Campaign Activity</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>📧 Email Campaigns</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance.email.sent} sent</div>
                <div className="text-sm text-gray-500">
                  {((overview.campaignPerformance.email.opened / overview.campaignPerformance.email.sent) * 100).toFixed(1)}% open rate
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span>📱 Social Media</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance.social.posts} posts</div>
                <div className="text-sm text-gray-500">
                  {overview.campaignPerformance.social.reach.toLocaleString()} reach
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span>🎯 Paid Ads</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance.ads.conversions} conversions</div>
                <div className="text-sm text-gray-500">
                  {overview.campaignPerformance.ads.roas.toFixed(1)}x ROAS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Recent Marketing Activity</h3>
        <RecentActivityFeed />
      </div>
    </div>
  );
}

// Campaigns Tab Component
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await fetch('/api/marketing/campaigns');
      const data = await response.json();
      setCampaigns(data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Active Campaigns</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Create Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Campaigns */}
        <CampaignSection
          title="Email Marketing"
          icon="📧"
          campaigns={[
            { name: 'Welcome Series', status: 'active', performance: '24% open rate' },
            { name: 'Cart Abandonment', status: 'active', performance: '18% recovery rate' },
            { name: 'VIP Collection Launch', status: 'scheduled', performance: 'Scheduled for tomorrow' }
          ]}
        />

        {/* Social Media Campaigns */}
        <CampaignSection
          title="Social Media"
          icon="📱"
          campaigns={[
            { name: 'Product Showcase', status: 'active', performance: '4.2% engagement' },
            { name: 'Behind the Scenes', status: 'active', performance: '6.8% engagement' },
            { name: 'Customer Testimonials', status: 'paused', performance: '3.1% engagement' }
          ]}
        />

        {/* Paid Advertising */}
        <CampaignSection
          title="Paid Advertising"
          icon="🎯"
          campaigns={[
            { name: 'Spring Collection FB Ads', status: 'active', performance: '3.2x ROAS' },
            { name: 'Retargeting Campaign', status: 'active', performance: '5.1x ROAS' },
            { name: 'Google Search Ads', status: 'active', performance: '2.8x ROAS' }
          ]}
        />
      </div>
    </div>
  );
}

// Automation Tab Component
function AutomationTab() {
  const [automations, setAutomations] = useState({
    email: { active: 0, total: 0 },
    social: { active: 0, total: 0 },
    crm: { active: 0, total: 0 }
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Automation */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📧 Email Automation</h3>
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              {automations.email.active} Active
            </span>
          </div>
          <div className="space-y-3">
            <AutomationRule
              name="Welcome Series"
              trigger="New user signup"
              status="active"
              performance="24% open rate"
            />
            <AutomationRule
              name="Cart Abandonment"
              trigger="Cart inactive 1 hour"
              status="active"
              performance="18% recovery"
            />
            <AutomationRule
              name="Post-Purchase Follow-up"
              trigger="Order completed"
              status="active"
              performance="31% satisfaction"
            />
          </div>
        </div>

        {/* Social Media Automation */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📱 Social Automation</h3>
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              {automations.social.active} Active
            </span>
          </div>
          <div className="space-y-3">
            <AutomationRule
              name="Product Showcase"
              trigger="New product added"
              status="active"
              performance="Auto-posted to 3 platforms"
            />
            <AutomationRule
              name="Customer Reviews"
              trigger="5-star review received"
              status="active"
              performance="Auto-shared testimonials"
            />
            <AutomationRule
              name="Weekly Schedule"
              trigger="Every Monday/Wednesday/Friday"
              status="active"
              performance="Consistent posting"
            />
          </div>
        </div>

        {/* CRM Automation */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">👥 CRM Automation</h3>
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              {automations.crm.active} Active
            </span>
          </div>
          <div className="space-y-3">
            <AutomationRule
              name="Lead Scoring"
              trigger="User behavior changes"
              status="active"
              performance="Auto-updates lead scores"
            />
            <AutomationRule
              name="HubSpot Sync"
              trigger="New customer data"
              status="active"
              performance="Real-time sync"
            />
            <AutomationRule
              name="Salesforce Integration"
              trigger="High-value purchase"
              status="active"
              performance="Auto-creates opportunities"
            />
          </div>
        </div>
      </div>

      {/* Automation Performance */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Automation Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">94%</div>
            <div className="text-sm text-gray-500">Automation Success Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">2.3hrs</div>
            <div className="text-sm text-gray-500">Time Saved Daily</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">$4,230</div>
            <div className="text-sm text-gray-500">Revenue from Automation</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Analytics Tab Component
function AnalyticsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Journey Analytics */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Customer Journey</h3>
          <div className="space-y-4">
            <JourneyStep step="Discovery" percentage={100} visitors="2,450" />
            <JourneyStep step="Interest" percentage={45} visitors="1,103" />
            <JourneyStep step="Consideration" percentage={32} visitors="785" />
            <JourneyStep step="Purchase" percentage={12} visitors="294" />
            <JourneyStep step="Retention" percentage={68} visitors="200" />
          </div>
        </div>

        {/* Channel Attribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Revenue Attribution</h3>
          <div className="space-y-3">
            <AttributionBar channel="Email Marketing" percentage={35} revenue="$8,450" />
            <AttributionBar channel="Social Media" percentage={28} revenue="$6,780" />
            <AttributionBar channel="Paid Ads" percentage={22} revenue="$5,320" />
            <AttributionBar channel="Direct Traffic" percentage={15} revenue="$3,630" />
          </div>
        </div>
      </div>

      {/* Advanced Analytics */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Advanced Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnalyticsMetric
            title="Customer Lifetime Value"
            value="$1,245"
            trend="+12.3%"
            description="Average CLV across all segments"
          />
          <AnalyticsMetric
            title="Acquisition Cost"
            value="$78"
            trend="-8.5%"
            description="Blended CAC across channels"
          />
          <AnalyticsMetric
            title="Retention Rate"
            value="68%"
            trend="+5.2%"
            description="12-month customer retention"
          />
          <AnalyticsMetric
            title="Engagement Score"
            value="76/100"
            trend="+14.1%"
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
  change: string;
  changeType: 'positive' | 'negative';
  icon: string;
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
      <div className={`mt-2 text-sm ${
        changeType === 'positive' ? 'text-green-600' : 'text-red-600'
      }`}>
        {change}
      </div>
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
  const channels = ['email', 'social', 'ads', 'crm'];
  
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

function CampaignSection({ title, icon, campaigns }: {
  title: string;
  icon: string;
  campaigns: Array<{ name: string; status: string; performance: string }>;
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center mb-4">
        <span className="text-xl mr-2">{icon}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">
        {campaigns.map((campaign, index) => (
          <div key={index} className="border-l-4 border-blue-500 pl-3">
            <div className="font-medium">{campaign.name}</div>
            <div className="text-sm text-gray-600">{campaign.performance}</div>
            <div className={`text-xs px-2 py-1 rounded inline-block mt-1 ${
              campaign.status === 'active' ? 'bg-green-100 text-green-800' :
              campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {campaign.status}
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
      <div className={`text-xs ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
        {trend}
      </div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </div>
  );
}

function RecentActivityFeed() {
  const activities = [
    { time: '2 min ago', activity: 'Cart abandonment email sent to 23 users', type: 'email' },
    { time: '15 min ago', activity: 'New Instagram post published: "Spring Collection"', type: 'social' },
    { time: '1 hour ago', activity: 'Facebook ad campaign optimization completed', type: 'ads' },
    { time: '2 hours ago', activity: '15 new contacts synced to HubSpot', type: 'crm' },
    { time: '3 hours ago', activity: 'Welcome email sequence triggered for 8 new users', type: 'email' }
  ];

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${
            activity.type === 'email' ? 'bg-blue-500' :
            activity.type === 'social' ? 'bg-purple-500' :
            activity.type === 'ads' ? 'bg-green-500' :
            'bg-orange-500'
          }`}></div>
          <div className="flex-1">
            <div className="text-sm">{activity.activity}</div>
            <div className="text-xs text-gray-500">{activity.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}