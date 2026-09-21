'use client';

import React, { useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import AdminContentManager from '@/components/AdminContentManager';
import AdminSiteContent from '@/components/AdminSiteContent';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import AdminOrders from '@/components/AdminOrders';
import AdminSettings, { adminSettingFieldId } from '@/components/AdminSettings';
import { InventoryDashboard } from '@/components/InventoryDashboard';
import { UnifiedMarketingDashboard } from '@/components/UnifiedMarketingDashboard';
import OrderCelebrationCard, { useOrderCelebration } from '@/components/admin/OrderCelebrationCard';
import StudioInboxPanel from '@/components/StudioInboxPanel';
import { buildLaunchReadinessItems } from '@/lib/setup-readiness';
import { 
  FileText, 
  ShoppingBag, 
  BarChart3, 
  Image as ImageIcon,
  ClipboardList,
  Package,
  Megaphone,
  Plus, 
  Calendar,
  Settings,
  TrendingUp,
  LayoutTemplate,
  Mail,
} from 'lucide-react';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json();
};

const ADMIN_TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'pages', label: 'Site Pages', icon: LayoutTemplate },
  { key: 'products', label: 'Products', icon: ShoppingBag },
  { key: 'portfolio', label: 'Portfolio', icon: ImageIcon },
  { key: 'posts', label: 'Updates', icon: FileText },
  { key: 'inbox', label: 'Inbox', icon: Mail },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'marketing', label: 'Marketing', icon: Megaphone },
  { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

type AdminTab = typeof ADMIN_TABS[number]['key'];

const ADMIN_TAB_GROUPS: Array<{ label: string; tabs: AdminTab[] }> = [
  { label: 'Site', tabs: ['overview', 'pages', 'analytics'] },
  { label: 'Content', tabs: ['products', 'portfolio', 'posts', 'inbox'] },
  { label: 'Shop', tabs: ['orders', 'inventory'] },
  { label: 'Growth & settings', tabs: ['marketing', 'settings'] },
];

const ADMIN_BOTTOM_NAV: Array<{ key: AdminTab; label: string; icon: typeof BarChart3 }> = [
  { key: 'overview', label: 'Home', icon: BarChart3 },
  { key: 'pages', label: 'Pages', icon: LayoutTemplate },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'inbox', label: 'Inbox', icon: Mail },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function isAdminTab(value: string): value is AdminTab {
  return ADMIN_TABS.some((tab) => tab.key === value);
}

function resolveAdminTab(tabParam: string | null | undefined, initialTab?: string | null): AdminTab {
  const candidates = [
    tabParam,
    initialTab,
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null,
  ];
  for (const value of candidates) {
    if (value && isAdminTab(value)) return value;
  }
  return 'overview';
}

interface DashboardStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalProducts: number;
  totalArtworks: number;
  totalViews: number;
  monthlyViews: number;
}

type SettingRecord = {
  key: string;
  value?: string;
  status: 'configured' | 'not_set';
};

type AdminDashboardProps = {
  initialTab?: string | null;
};

export default function AdminDashboard({ initialTab = null }: AdminDashboardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: AdminTab = resolveAdminTab(searchParams.get('tab'), initialTab);
  const [readinessExpanded, setReadinessExpanded] = React.useState(true);

  const selectTab = useCallback((tab: AdminTab, hash?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    if (tab !== 'pages') {
      params.delete('page');
      params.delete('section');
    }
    const query = params.toString();
    const path = query ? `/admin?${query}` : '/admin';
    router.replace(hash ? `${path}#${hash}` : path, { scroll: false });
  }, [router, searchParams]);

  // Fetch dashboard data
  const { data: stats, error: statsError } = useSWR<DashboardStats>('/api/admin/stats', fetcher);
  const { data: settingsData, error: settingsError } = useSWR<{ settings: SettingRecord[] }>('/api/admin/settings', fetcher);
  const { data: promoData } = useSWR<{ promoCodes: Array<{ id: string }> }>('/api/admin/promo-codes', fetcher);
  const { data: healthData } = useSWR<{ services?: { database?: string }; databaseHint?: string }>('/api/health', fetcher);
  const { celebration, dismissCelebration } = useOrderCelebration();

  const safeStats: DashboardStats = {
    totalPosts: Number(stats?.totalPosts || 0),
    publishedPosts: Number(stats?.publishedPosts || 0),
    draftPosts: Number(stats?.draftPosts || 0),
    totalProducts: Number(stats?.totalProducts || 0),
    totalArtworks: Number(stats?.totalArtworks || 0),
    totalViews: Number(stats?.totalViews || 0),
    monthlyViews: Number(stats?.monthlyViews || 0),
  };
  const settingStatus = new Map((settingsData?.settings || []).map((setting) => [setting.key, setting.status]));
  const settingValues = new Map((settingsData?.settings || []).map((setting) => [setting.key, setting.value || '']));
  const databaseHealthy = healthData?.services?.database === 'healthy';
  const readinessItems = buildLaunchReadinessItems({
    stats: safeStats,
    settings: settingStatus,
    settingValues,
    promoCount: promoData?.promoCodes?.length || 0,
    databaseHealthy: healthData ? databaseHealthy : undefined,
  });
  const incompleteReadinessItems = readinessItems.filter((item) => !item.complete && !item.optional);
  const databaseBlocked = healthData && !databaseHealthy;

  useEffect(() => {
    if (status === 'unauthenticated') {
      const callbackUrl = typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/admin';
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }, [router, status]);

  // Check authentication
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return null;
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {celebration && (
        <OrderCelebrationCard celebration={celebration} onDismiss={dismissCelebration} />
      )}

      {databaseBlocked && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-950">Database not connected</h2>
          <p className="mt-1 text-sm text-red-900">
            {healthData?.databaseHint || 'Your site cannot save orders or content until the database connection works. Ask your host to verify DATABASE_URL.'}
          </p>
        </div>
      )}

      {statsError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Could not load dashboard stats. If this persists, check your database connection in Settings.
        </div>
      )}

      {incompleteReadinessItems.length > 0 && !settingsError && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-blue-950">
                Launch readiness · {incompleteReadinessItems.length} remaining
              </h2>
              <p className="mt-0.5 text-sm text-blue-900">
                Finish these from this dashboard before launch.
              </p>
            </div>
            <button
              type="button"
              className="tap-target-inline rounded border border-blue-200 bg-white text-sm font-medium text-blue-950 hover:bg-blue-100"
              aria-expanded={readinessExpanded}
              onClick={() => setReadinessExpanded((current) => !current)}
            >
              {readinessExpanded ? 'Hide checklist' : 'Show checklist'}
            </button>
          </div>
          {readinessExpanded && (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {incompleteReadinessItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-label={`${item.action}: ${item.label}`}
                  onClick={() => {
                    if (item.settingKey) {
                      selectTab('settings', adminSettingFieldId(item.settingKey));
                    } else {
                      selectTab(item.tab as AdminTab);
                    }
                  }}
                  className="rounded border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-blue-950 hover:bg-blue-100"
                >
                  <span className="block">{item.label}</span>
                  <span className="mt-1 block text-xs font-normal text-blue-700">
                    {item.helpText}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(statsError || settingsError) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Some admin data is temporarily unavailable. You can still navigate tabs and continue editing content.
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4 md:p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-7 w-7 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Updates</p>
              <p className="text-xl font-semibold text-gray-900">{safeStats.totalPosts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4 md:p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShoppingBag className="h-7 w-7 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Products</p>
              <p className="text-xl font-semibold text-gray-900">{safeStats.totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4 md:p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-7 w-7 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Views</p>
              <p className="text-xl font-semibold text-gray-900">{safeStats.totalViews.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4 md:p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-7 w-7 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Monthly Views</p>
              <p className="text-xl font-semibold text-gray-900">{safeStats.monthlyViews.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-4 md:p-5">
        <h3 className="text-base font-medium text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => selectTab('posts')}
            className="flex items-center justify-center p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <FileText className="h-5 w-5 text-gray-400 mr-2" />
            <span className="text-gray-600 text-sm">New update</span>
          </button>
          
          <button onClick={() => selectTab('products')} className="flex items-center justify-center p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
            <Plus className="h-5 w-5 text-gray-400 mr-2" />
            <span className="text-gray-600 text-sm">Add Product</span>
          </button>
          
          <button onClick={() => selectTab('orders')} className="flex items-center justify-center p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
            <ClipboardList className="h-5 w-5 text-gray-400 mr-2" />
            <span className="text-gray-600 text-sm">Manage orders</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your content and monitor site performance</p>
      </div>

      <div className="md:hidden mb-4">
        <p className="text-sm text-gray-600">
          {ADMIN_TABS.find((tab) => tab.key === activeTab)?.label ?? 'Admin'} section
        </p>
      </div>

      {/* Navigation Tabs — grouped for scanability without a separate sidebar */}
      <div className="sticky top-0 z-30 mb-8 hidden overflow-x-auto border-b border-gray-200 bg-gray-50/95 backdrop-blur md:block">
        <nav className="-mb-px flex min-w-max items-end gap-1 sm:gap-2" role="tablist" aria-label="Admin sections">
          {ADMIN_TAB_GROUPS.map((group, groupIndex) => (
            <div
              key={group.label}
              className={`flex items-end gap-1 sm:gap-2 ${groupIndex > 0 ? 'ml-2 border-l border-gray-200 pl-3 sm:ml-3 sm:pl-4' : ''}`}
            >
              <span className="mb-2 hidden text-[10px] font-semibold uppercase tracking-wide text-gray-400 lg:inline">
                {group.label}
              </span>
              {group.tabs.map((tabKey) => {
                const tab = ADMIN_TABS.find((entry) => entry.key === tabKey);
                if (!tab) return null;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    id={`admin-tab-${tab.key}`}
                    aria-selected={activeTab === tab.key}
                    aria-controls={`admin-panel-${tab.key}`}
                    onClick={() => selectTab(tab.key)}
                    className={`flex flex-shrink-0 items-center whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={16} className="mr-2" aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div role="tabpanel" id={`admin-panel-${activeTab}`} aria-labelledby={`admin-tab-${activeTab}`}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'pages' && <AdminSiteContent />}
        {activeTab === 'posts' && <AdminContentManager section="posts" />}
        {activeTab === 'inbox' && (
          <StudioInboxPanel mode="admin" apiBase="/api/admin/messages" />
        )}
        {activeTab === 'products' && (
          <AdminContentManager section="products" />
        )}
        {activeTab === 'portfolio' && (
          <AdminContentManager section="artworks" />
        )}
        {activeTab === 'orders' && (
          <AdminOrders />
        )}
        {activeTab === 'inventory' && (
          <InventoryDashboard />
        )}
        {activeTab === 'marketing' && (
          <UnifiedMarketingDashboard />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard />
        )}
        {activeTab === 'settings' && (
          <AdminSettings />
        )}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden safe-area-bottom"
        aria-label="Admin quick navigation"
      >
        <div className="grid grid-cols-5">
          {ADMIN_BOTTOM_NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              aria-current={activeTab === key ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium ${
                activeTab === key ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}