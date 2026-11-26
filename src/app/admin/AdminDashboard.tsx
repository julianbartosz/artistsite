'use client';

import React, { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import OrderCelebrationCard, { useOrderCelebration } from '@/components/admin/OrderCelebrationCard';
import type { OrderCelebration } from '@/lib/order-celebration-shared';
import { confirmLeaveWithUnsavedChanges } from '@/components/admin/useUnsavedChangesGuard';
import { buildLaunchReadinessItems } from '@/lib/setup-readiness';
import type { SiteContentByPage } from '@/lib/site-content-shared';
import {
  FileText,
  ShoppingBag,
  Image as ImageIcon,
  ClipboardList,
  Megaphone,
  Newspaper,
  Plus,
  Settings,
  TrendingUp,
  LayoutTemplate,
  LayoutDashboard,
  Mail,
  MoreHorizontal,
  ExternalLink,
  Store,
  Sparkles,
} from 'lucide-react';

/** Keep in sync with `adminSettingFieldId` in AdminSettings (avoid static-importing the Settings panel). */
function adminSettingFieldId(key: string): string {
  return `setting-${key}`;
}

function TabPanelFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-busy="true">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-1/3 rounded bg-gray-200" />
        <div className="h-40 rounded bg-gray-100" />
        <div className="h-40 rounded bg-gray-100" />
      </div>
    </div>
  );
}

/** Lazy-load each Studio panel so switching tabs does not parse TipTap/marketing/analytics up front. */
const AdminContentManager = dynamic(() => import('@/components/AdminContentManager'), {
  loading: () => <TabPanelFallback />,
  ssr: false,
});
const AdminSiteContent = dynamic(() => import('@/components/AdminSiteContent'), {
  loading: () => <TabPanelFallback />,
  ssr: false,
});
const AnalyticsDashboard = dynamic(() => import('@/components/AnalyticsDashboard'), {
  loading: () => <TabPanelFallback />,
  ssr: false,
});
const AdminOrders = dynamic(() => import('@/components/AdminOrders'), {
  loading: () => <TabPanelFallback />,
  ssr: false,
});
const AdminNewsletter = dynamic(() => import('@/components/AdminNewsletter'), {
  loading: () => <TabPanelFallback />,
  ssr: false,
});
const AdminSettings = dynamic(
  () => import('@/components/AdminSettings').then((mod) => ({ default: mod.default })),
  { loading: () => <TabPanelFallback />, ssr: false },
);
const InventoryDashboard = dynamic(
  () => import('@/components/InventoryDashboard').then((mod) => ({ default: mod.InventoryDashboard })),
  { loading: () => <TabPanelFallback />, ssr: false },
);
const UnifiedMarketingDashboard = dynamic(
  () => import('@/components/UnifiedMarketingDashboard').then((mod) => ({ default: mod.UnifiedMarketingDashboard })),
  { loading: () => <TabPanelFallback />, ssr: false },
);
const StudioInboxPanel = dynamic(() => import('@/components/StudioInboxPanel'), {
  loading: () => <TabPanelFallback />,
  ssr: false,
});
const AdminMarkets = dynamic(() => import('@/components/AdminMarkets'), {
  loading: () => <TabPanelFallback />,
  ssr: false,
});
const AdminJobs = dynamic(() => import('@/components/AdminJobs'), {
  loading: () => <TabPanelFallback />,
  ssr: false,
});
const AdminConsignment = dynamic(() => import('@/components/AdminConsignment'), {
  loading: () => <TabPanelFallback />,
  ssr: false,
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json();
};

const swrStudioOptions = {
  revalidateOnFocus: false,
  dedupingInterval: 10_000,
} as const;

const ADMIN_TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'inbox', label: 'Inbox', icon: Mail },
  { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'products', label: 'Products', icon: ShoppingBag },
  { key: 'markets', label: 'Markets', icon: Store },
  { key: 'pages', label: 'Pages', icon: LayoutTemplate },
  { key: 'portfolio', label: 'Portfolio', icon: ImageIcon },
  { key: 'posts', label: 'Updates', icon: FileText },
  { key: 'newsletter', label: 'Newsletter', icon: Newspaper },
  { key: 'automations', label: 'Automations', icon: Sparkles },
  { key: 'marketing', label: 'Marketing', icon: Megaphone },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

type AdminTab = typeof ADMIN_TABS[number]['key'];

/**
 * Desktop workspace areas organized around how artists actually work:
 * - Home: daily pulse, collector messages, and whole-studio analytics
 * - Shop: fulfillment, catalog/stock, and in-person markets
 * - Site: everything published to the public website
 * - Grow: newsletters, automated emails, and promos/social/ads
 * Settings stays one click away in the top-right utility bar from every view.
 */
const ADMIN_TAB_GROUPS: Array<{ id: string; label: string; tabs: AdminTab[] }> = [
  { id: 'home', label: 'Home', tabs: ['overview', 'inbox', 'analytics'] },
  { id: 'shop', label: 'Shop', tabs: ['orders', 'products', 'markets'] },
  { id: 'site', label: 'Site', tabs: ['pages', 'portfolio', 'posts'] },
  { id: 'grow', label: 'Grow', tabs: ['newsletter', 'automations', 'marketing'] },
];

// Month-1 ops path: fulfillment + inbox stay one tap away once real orders arrive.
const ADMIN_BOTTOM_NAV: Array<{ key: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'inbox', label: 'Inbox', icon: Mail },
  { key: 'products', label: 'Products', icon: ShoppingBag },
];

const ADMIN_BOTTOM_PRIMARY = new Set<AdminTab>(ADMIN_BOTTOM_NAV.map((entry) => entry.key));

function isAdminTab(value: string): value is AdminTab {
  return ADMIN_TABS.some((tab) => tab.key === value);
}

function adminGroupForTab(tab: AdminTab) {
  return ADMIN_TAB_GROUPS.find((group) => group.tabs.includes(tab)) ?? null;
}

function resolveAdminTab(
  tabParam: string | null | undefined,
  initialTab?: string | null,
  viewParam?: string | null,
  automationParam?: string | null,
): AdminTab {
  const candidates = [
    tabParam,
    initialTab,
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null,
  ];
  for (const value of candidates) {
    if (value === 'inventory') return 'products';
    // Backwards compatibility for old ?tab=newsletter&view=automations or ?tab=newsletter&automation=<id> links.
    if (value === 'newsletter' && (viewParam === 'automations' || Boolean(automationParam))) {
      return 'automations';
    }
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
  totalOrders?: number;
  unfulfilledOrdersCount?: number;
  totalThreadsCount?: number;
  unreadMessagesCount?: number;
  lowStockCount?: number;
  activeAlertsCount?: number;
  latestCelebration?: OrderCelebration | null;
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
  const rawTabParam = searchParams.get('tab');
  const rawViewParam = searchParams.get('view');
  const rawAutomationParam = searchParams.get('automation');
  const activeTab: AdminTab = resolveAdminTab(rawTabParam, initialTab, rawViewParam, rawAutomationParam);
  const activeGroup = adminGroupForTab(activeTab);
  const productsView: 'catalog' | 'stock' | 'consignment' =
    activeTab === 'products' &&
    (rawViewParam === 'stock' || rawTabParam === 'inventory' || (!rawTabParam && initialTab === 'inventory'))
      ? 'stock'
      : activeTab === 'products' && rawViewParam === 'consignment'
        ? 'consignment'
        : 'catalog';
  const ordersView: 'orders' | 'jobs' =
    activeTab === 'orders' && rawViewParam === 'jobs' ? 'jobs' : 'orders';
  const activeJobIdParam = activeTab === 'orders' ? searchParams.get('job') : null;
  const [readinessExpanded, setReadinessExpanded] = React.useState(true);
  const [mobileMoreOpen, setMobileMoreOpen] = React.useState(false);
  const moreTabs = ADMIN_TABS.filter((tab) => !ADMIN_BOTTOM_PRIMARY.has(tab.key));
  const moreTabActive = moreTabs.some((tab) => tab.key === activeTab);

  const selectTab = useCallback((
    tab: AdminTab,
    hash?: string,
    options?: { create?: boolean; product?: string; view?: string; job?: string },
  ) => {
    if (tab !== activeTab && !confirmLeaveWithUnsavedChanges()) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    if (tab !== 'pages') {
      params.delete('page');
      params.delete('section');
    }
    if (tab !== 'newsletter') {
      params.delete('newsletter');
    }
    if (tab !== 'automations') {
      params.delete('automation');
    }
    if (options?.view) {
      if (
        options.view === 'catalog' ||
        options.view === 'orders' ||
        options.view === 'newsletters' ||
        options.view === 'promos'
      ) {
        params.delete('view');
      } else {
        params.set('view', options.view);
      }
    } else if (tab !== activeTab) {
      params.delete('view');
    } else if (tab !== 'newsletter' && tab !== 'products' && tab !== 'orders' && tab !== 'marketing') {
      params.delete('view');
    }
    if (tab === 'orders' && options?.job) {
      params.set('job', options.job);
    } else {
      params.delete('job');
    }
    if (tab === 'products' && options?.product) {
      params.set('product', options.product);
      params.delete('view');
    } else {
      params.delete('product');
    }
    if (options?.create) {
      params.set('create', '1');
      if (tab === 'products') params.delete('view');
    } else {
      params.delete('create');
    }
    const query = params.toString();
    const path = query ? `/admin?${query}` : '/admin';
    const nextUrl = hash ? `${path}#${hash}` : path;
    if (typeof window !== 'undefined') {
      // Pass null state so Next.js's replaceState wrapper syncs useSearchParams() immediately without an RSC round-trip.
      window.history.replaceState(null, '', nextUrl);
      if (hash) {
        window.requestAnimationFrame(() => {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
          const target = document.getElementById(hash);
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    } else {
      router.replace(nextUrl, { scroll: false });
    }
  }, [activeTab, router, searchParams]);

  const selectGroup = useCallback((groupId: string) => {
    const group = ADMIN_TAB_GROUPS.find((entry) => entry.id === groupId);
    if (!group) return;
    if (group.tabs.includes(activeTab)) return;
    selectTab(group.tabs[0]);
  }, [activeTab, selectTab]);

  // Keep lightweight operational counts warm for tab badges; gate heavier readiness calls to Overview only.
  const isAdminSession = status === 'authenticated' && Boolean(session?.user?.isAdmin);
  const overviewActive = isAdminSession && activeTab === 'overview';
  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR<DashboardStats>(
    isAdminSession ? '/api/admin/stats' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  const { data: settingsData, error: settingsError, isLoading: settingsLoading } = useSWR<{ settings: SettingRecord[] }>(
    overviewActive ? '/api/admin/settings' : null,
    fetcher,
    swrStudioOptions,
  );
  const { data: siteContentData } = useSWR<SiteContentByPage>(
    overviewActive ? '/api/admin/site-content' : null,
    fetcher,
    swrStudioOptions,
  );
  const { data: promoData } = useSWR<{ promoCodes: Array<{ id: string }> }>(
    overviewActive ? '/api/admin/promo-codes' : null,
    fetcher,
    swrStudioOptions,
  );
  const { data: healthData } = useSWR<{ services?: { database?: string }; databaseHint?: string }>(
    overviewActive ? '/api/health' : null,
    async (url: string) => {
      const res = await fetch(url);
      const data = await res.json().catch(() => null);
      if (!data || typeof data !== 'object') {
        throw new Error(`Health check failed with status ${res.status}`);
      }
      return data;
    },
    swrStudioOptions,
  );
  const { celebration, dismissCelebration } = useOrderCelebration(stats?.latestCelebration ?? null);

  const overviewLoading = statsLoading || settingsLoading;
  const safeStats: DashboardStats = {
    totalPosts: Number(stats?.totalPosts || 0),
    publishedPosts: Number(stats?.publishedPosts || 0),
    draftPosts: Number(stats?.draftPosts || 0),
    totalProducts: Number(stats?.totalProducts || 0),
    totalArtworks: Number(stats?.totalArtworks || 0),
    totalViews: Number(stats?.totalViews || 0),
    monthlyViews: Number(stats?.monthlyViews || 0),
    totalOrders: Number(stats?.totalOrders || 0),
    unfulfilledOrdersCount: Number(stats?.unfulfilledOrdersCount || 0),
    totalThreadsCount: Number(stats?.totalThreadsCount || 0),
    unreadMessagesCount: Number(stats?.unreadMessagesCount || 0),
    lowStockCount: Number(stats?.lowStockCount || 0),
    activeAlertsCount: Number(stats?.activeAlertsCount || 0),
  };
  const settingStatus = new Map((settingsData?.settings || []).map((setting) => [setting.key, setting.status]));
  const settingValues = new Map((settingsData?.settings || []).map((setting) => [setting.key, setting.value || '']));
  const databaseHealthy = healthData?.services?.database === 'healthy';
  const readinessItems = buildLaunchReadinessItems({
    content: siteContentData ?? null,
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
      return;
    }
  }, [router, session, status]);

  // Check authentication
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return null;
  }

  if (!session.user?.isAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Studio access required</h1>
        <p className="mt-3 text-sm text-gray-600">
          You are signed in, but this account is not on the studio access list. Ask the site owner to add your email to ADMIN_EMAILS, then sign out and back in.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
            View site
          </Link>
          <button
            type="button"
            onClick={() => {
              void signOut({ callbackUrl: '/' });
            }}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const tabBadgeCount = (tabKey: AdminTab): number => {
    if (tabKey === 'orders') return safeStats.unfulfilledOrdersCount || 0;
    if (tabKey === 'inbox') return safeStats.unreadMessagesCount || 0;
    return 0;
  };

  const groupHasAttention = (groupId: string): boolean => {
    if (groupId === 'home') return (safeStats.unreadMessagesCount || 0) > 0;
    if (groupId === 'shop') return (safeStats.unfulfilledOrdersCount || 0) > 0;
    return false;
  };

  const handleSelectTabString = (tab: string) => {
    if (tab === 'inventory') {
      selectTab('products', undefined, { view: 'stock' });
    } else if (isAdminTab(tab)) {
      selectTab(tab);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {celebration && (
        <OrderCelebrationCard
          celebration={celebration}
          onDismiss={dismissCelebration}
          onSelectTab={handleSelectTabString}
        />
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

      {!overviewLoading && incompleteReadinessItems.length > 0 && !settingsError && (
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

      {/* Stats Grid — clickable jump cards into each studio area */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => selectTab('orders')}
          className="rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow"
        >
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-indigo-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500">Orders</p>
              <p className="text-xl font-semibold text-gray-900">
                {statsLoading ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-gray-200 align-middle" /> : safeStats.totalOrders}
              </p>
              {!statsLoading && (safeStats.unfulfilledOrdersCount || 0) > 0 && (
                <p className="text-xs font-medium text-indigo-700">
                  {safeStats.unfulfilledOrdersCount} to ship
                </p>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => selectTab('inbox')}
          className="rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow"
        >
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500">Inbox</p>
              <p className="text-xl font-semibold text-gray-900">
                {statsLoading ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-gray-200 align-middle" /> : safeStats.totalThreadsCount}
              </p>
              {!statsLoading && (safeStats.unreadMessagesCount || 0) > 0 && (
                <p className="text-xs font-medium text-rose-700">
                  {safeStats.unreadMessagesCount} unread
                </p>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => selectTab('products', undefined, (safeStats.lowStockCount || 0) > 0 ? { view: 'stock' } : undefined)}
          className="rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow"
        >
          <div className="flex items-start gap-3">
            <ShoppingBag className="mt-0.5 h-6 w-6 shrink-0 text-green-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500">Products</p>
              <p className="text-xl font-semibold text-gray-900">
                {statsLoading ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-gray-200 align-middle" /> : safeStats.totalProducts}
              </p>
              {!statsLoading && (safeStats.lowStockCount || 0) > 0 && (
                <p className="text-xs font-medium text-amber-700">
                  {safeStats.lowStockCount} low stock
                </p>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => selectTab('portfolio')}
          className="rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow"
        >
          <div className="flex items-start gap-3">
            <ImageIcon className="mt-0.5 h-6 w-6 shrink-0 text-violet-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500">Portfolio</p>
              <p className="text-xl font-semibold text-gray-900">
                {statsLoading ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-gray-200 align-middle" /> : safeStats.totalArtworks}
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => selectTab('posts')}
          className="rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow"
        >
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500">Updates</p>
              <p className="text-xl font-semibold text-gray-900">
                {statsLoading ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-gray-200 align-middle" /> : safeStats.totalPosts}
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => selectTab('analytics')}
          className="rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow"
        >
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-6 w-6 shrink-0 text-orange-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500">Monthly Views</p>
              <p className="text-xl font-semibold text-gray-900">
                {statsLoading ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-gray-200 align-middle" /> : safeStats.monthlyViews.toLocaleString()}
              </p>
              {!statsLoading && safeStats.totalViews > safeStats.monthlyViews && (
                <p className="text-xs text-gray-500">{safeStats.totalViews.toLocaleString()} all-time</p>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Quick Actions — high-frequency studio tasks */}
      <div className="rounded-lg border bg-white p-4 shadow-sm md:p-5">
        <h3 className="mb-3 text-base font-medium text-gray-900">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => selectTab('pages')}
            className="flex items-center justify-center rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            <LayoutTemplate className="mr-2 h-5 w-5 text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-700">Customize site pages</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('products', undefined, { create: true })}
            className="flex items-center justify-center rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            <Plus className="mr-2 h-5 w-5 text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-700">Add product</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('portfolio', undefined, { create: true })}
            className="flex items-center justify-center rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            <ImageIcon className="mr-2 h-5 w-5 text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-700">Add portfolio piece</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('posts', undefined, { create: true })}
            className="flex items-center justify-center rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            <FileText className="mr-2 h-5 w-5 text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-700">New update</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('markets')}
            className="flex items-center justify-center rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            <Store className="mr-2 h-5 w-5 text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-700">Open Market POS</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('newsletter')}
            className="flex items-center justify-center rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            <Newspaper className="mr-2 h-5 w-5 text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-700">Write newsletter</span>
          </button>
        </div>
      </div>
    </div>
  );

  const activeTabLabel = ADMIN_TABS.find((tab) => tab.key === activeTab)?.label ?? 'Studio';
  const stockBadgeCount = Math.max(safeStats.activeAlertsCount || 0, safeStats.lowStockCount || 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:pb-8 lg:px-8">
      {/* Sticky studio chrome: public header is hidden on /admin, so exit + settings + session live here */}
      <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-gray-200 bg-gray-50/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => selectTab('overview')}
                className="text-left hover:opacity-80"
              >
                <h1 className="truncate text-base font-semibold text-gray-900 sm:text-lg">Studio</h1>
              </button>
              <p className="truncate text-xs text-gray-500 md:hidden">{activeTabLabel}</p>
            </div>
            <div
              className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex"
              role="navigation"
              aria-label="Studio areas"
            >
              {ADMIN_TAB_GROUPS.map((group, groupIndex) => {
                const isActive = activeGroup?.id === group.id;
                const hasAttention = !isActive && groupHasAttention(group.id);
                return (
                  <React.Fragment key={group.id}>
                    {groupIndex > 0 && (
                      <span className="mx-0.5 h-4 w-px shrink-0 bg-gray-200" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      aria-current={isActive ? 'true' : undefined}
                      aria-expanded={isActive}
                      aria-controls={isActive ? 'admin-group-tabs' : undefined}
                      onClick={() => selectGroup(group.id)}
                      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                          : 'text-gray-500 hover:bg-white/70 hover:text-gray-800'
                      }`}
                    >
                      <span>{group.label}</span>
                      {hasAttention && (
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              id="admin-tab-settings"
              aria-current={activeTab === 'settings' ? 'page' : undefined}
              onClick={() => selectTab('settings')}
              className={`hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors md:inline-flex ${
                activeTab === 'settings'
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <Settings size={15} aria-hidden="true" />
              Settings
            </button>
            <Link
              href="/"
              onClick={(event) => {
                if (!confirmLeaveWithUnsavedChanges()) event.preventDefault();
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-white hover:text-gray-900"
            >
              <ExternalLink size={14} aria-hidden="true" />
              View site
            </Link>
            <button
              type="button"
              onClick={() => {
                if (!confirmLeaveWithUnsavedChanges()) return;
                void signOut({ callbackUrl: '/' });
              }}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>

        {activeGroup && (
          <nav
            id="admin-group-tabs"
            className="-mb-px hidden min-w-0 gap-4 overflow-x-auto md:flex"
            role="tablist"
            aria-label={`${activeGroup.label} sections`}
          >
            {activeGroup.tabs.map((tabKey) => {
              const tab = ADMIN_TABS.find((entry) => entry.key === tabKey);
              if (!tab) return null;
              const Icon = tab.icon;
              const badgeCount = tabBadgeCount(tab.key);
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`admin-tab-${tab.key}`}
                  aria-selected={activeTab === tab.key}
                  aria-controls={`admin-panel-${tab.key}`}
                  onClick={() => selectTab(tab.key)}
                  className={`inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 py-2 text-sm font-medium ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{tab.label}</span>
                  {badgeCount > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
                        activeTab === tab.key
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Tab Content */}
      <div role="tabpanel" id={`admin-panel-${activeTab}`} aria-labelledby={`admin-tab-${activeTab}`}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'pages' && <AdminSiteContent />}
        {activeTab === 'posts' && <AdminContentManager section="posts" />}
        {activeTab === 'inbox' && (
          <StudioInboxPanel
            mode="admin"
            apiBase="/api/admin/messages"
            onOpenJob={(jobId) => selectTab('orders', undefined, { view: 'jobs', job: jobId })}
          />
        )}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Shop products</h2>
                <p className="mt-0.5 text-sm text-gray-600">
                  {productsView === 'stock'
                    ? 'Update stock quantities inline, review low-stock alerts, and configure category thresholds.'
                    : 'Listings collectors can buy online or at markets. Stock, price, and shipping live here.'}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto" role="tablist" aria-label="Products views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={productsView === 'catalog'}
                  onClick={() => selectTab('products', undefined, { view: 'catalog' })}
                  className={`shrink-0 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                    productsView === 'catalog'
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Catalog
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={productsView === 'stock'}
                  onClick={() => selectTab('products', undefined, { view: 'stock' })}
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                    productsView === 'stock'
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>Stock &amp; alerts</span>
                  {stockBadgeCount > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
                        productsView === 'stock'
                          ? 'bg-amber-400/25 text-amber-100'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {stockBadgeCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={productsView === 'consignment'}
                  onClick={() => selectTab('products', undefined, { view: 'consignment' })}
                  className={`shrink-0 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                    productsView === 'consignment'
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Consignments
                </button>
              </div>
            </div>

            {productsView === 'stock' ? (
              <InventoryDashboard
                embedded
                onOpenProduct={(productId) =>
                  selectTab(
                    'products',
                    undefined,
                    productId ? { product: productId, view: 'catalog' } : { create: true, view: 'catalog' },
                  )
                }
              />
            ) : productsView === 'consignment' ? (
              <AdminConsignment />
            ) : (
              <AdminContentManager section="products" hideIntro />
            )}
          </div>
        )}
        {activeTab === 'portfolio' && (
          <AdminContentManager section="artworks" />
        )}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Orders &amp; Jobs</h2>
                <p className="text-sm text-gray-600">
                  Fulfill shop and market orders, or manage custom commission proposals and payment plans.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2" role="tablist" aria-label="Orders workspace">
                <button
                  type="button"
                  role="tab"
                  aria-selected={ordersView === 'orders'}
                  onClick={() => selectTab('orders', undefined, { view: 'orders' })}
                  className={`shrink-0 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                    ordersView === 'orders'
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Orders
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={ordersView === 'jobs'}
                  onClick={() => selectTab('orders', undefined, { view: 'jobs' })}
                  className={`shrink-0 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                    ordersView === 'jobs'
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Jobs
                </button>
              </div>
            </div>

            {ordersView === 'jobs' ? (
              <AdminJobs initialJobId={activeJobIdParam} />
            ) : (
              <AdminOrders hideIntro />
            )}
          </div>
        )}
        {activeTab === 'markets' && (
          <AdminMarkets onSelectTab={handleSelectTabString} />
        )}
        {activeTab === 'marketing' && (
          <UnifiedMarketingDashboard onSelectTab={handleSelectTabString} />
        )}
        {activeTab === 'newsletter' && (
          <AdminNewsletter mode="newsletters" onSelectTab={handleSelectTabString} />
        )}
        {activeTab === 'automations' && (
          <AdminNewsletter mode="automations" onSelectTab={handleSelectTabString} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard onSelectTab={handleSelectTabString} />
        )}
        {activeTab === 'settings' && (
          <AdminSettings onSelectTab={handleSelectTabString} />
        )}
      </div>

      <nav
        className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden"
        aria-label="Admin quick navigation"
      >
        <div className="grid grid-cols-5">
          {ADMIN_BOTTOM_NAV.map(({ key, label, icon: Icon }) => {
            const badgeCount = tabBadgeCount(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMobileMoreOpen(false);
                  selectTab(key);
                }}
                aria-current={activeTab === key ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium ${
                  activeTab === key ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                <span className="relative">
                  <Icon size={18} aria-hidden="true" />
                  {badgeCount > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-tight text-white">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMoreOpen((open) => !open)}
            aria-expanded={mobileMoreOpen}
            aria-controls="admin-more-sheet"
            aria-current={moreTabActive && !mobileMoreOpen ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium ${
              moreTabActive || mobileMoreOpen ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            <MoreHorizontal size={18} aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {mobileMoreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More admin sections">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close more menu"
            onClick={() => setMobileMoreOpen(false)}
          />
          <div
            id="admin-more-sheet"
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Studio tools</p>
              <button
                type="button"
                className="text-sm font-medium text-gray-600"
                onClick={() => setMobileMoreOpen(false)}
              >
                Close
              </button>
            </div>
            <Link
              href="/"
              className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-800"
              onClick={(event) => {
                setMobileMoreOpen(false);
                if (!confirmLeaveWithUnsavedChanges()) event.preventDefault();
              }}
            >
              <ExternalLink size={16} aria-hidden="true" />
              View site
            </Link>
            <div className="space-y-4">
              {ADMIN_TAB_GROUPS.map((group) => {
                const groupTabs = group.tabs
                  .filter((tabKey) => !ADMIN_BOTTOM_PRIMARY.has(tabKey))
                  .map((tabKey) => ADMIN_TABS.find((entry) => entry.key === tabKey))
                  .filter((entry): entry is typeof ADMIN_TABS[number] => Boolean(entry));
                if (groupTabs.length === 0) return null;
                return (
                  <div key={group.id}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {group.label}
                    </p>
                    <ul className="grid grid-cols-2 gap-2">
                      {groupTabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <li key={tab.key}>
                            <button
                              type="button"
                              onClick={() => {
                                setMobileMoreOpen(false);
                                selectTab(tab.key);
                              }}
                              className={`flex min-h-12 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm font-medium ${
                                activeTab === tab.key
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 text-gray-800'
                              }`}
                            >
                              <Icon size={17} aria-hidden="true" />
                              {tab.label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Configuration
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    selectTab('settings');
                  }}
                  className={`flex min-h-12 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm font-medium ${
                    activeTab === 'settings'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-800'
                  }`}
                >
                  <Settings size={17} aria-hidden="true" />
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
