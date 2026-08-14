'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import AdminContentManager from '@/components/AdminContentManager';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import AdminOrders from '@/components/AdminOrders';
import AdminSettings from '@/components/AdminSettings';
import { InventoryDashboard } from '@/components/InventoryDashboard';
import { UnifiedMarketingDashboard } from '@/components/UnifiedMarketingDashboard';
import { 
  FileText, 
  ShoppingBag, 
  BarChart3, 
  Image as ImageIcon,
  ClipboardList,
  Package,
  Megaphone,
  Plus, 
  Eye,
  Calendar,
  Settings,
  TrendingUp,
} from 'lucide-react';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json();
};

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
  status: 'configured' | 'not_set';
};

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: string;
  views: number;
  featured: boolean;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'products' | 'portfolio' | 'orders' | 'inventory' | 'marketing' | 'analytics' | 'settings'>('overview');

  // Fetch dashboard data
  const { data: stats, error: statsError } = useSWR<DashboardStats>('/api/admin/stats', fetcher);
  const { data: posts, error: postsError } = useSWR<BlogPost[]>('/api/admin/posts', fetcher);
  const { data: settingsData, error: settingsError } = useSWR<{ settings: SettingRecord[] }>('/api/admin/settings', fetcher);

  const safeStats: DashboardStats = {
    totalPosts: Number(stats?.totalPosts || 0),
    publishedPosts: Number(stats?.publishedPosts || 0),
    draftPosts: Number(stats?.draftPosts || 0),
    totalProducts: Number(stats?.totalProducts || 0),
    totalArtworks: Number(stats?.totalArtworks || 0),
    totalViews: Number(stats?.totalViews || 0),
    monthlyViews: Number(stats?.monthlyViews || 0),
  };

  const safePosts: BlogPost[] = Array.isArray(posts) ? posts : [];
  const settingStatus = new Map((settingsData?.settings || []).map((setting) => [setting.key, setting.status]));
  const hasAnyConfigured = (keys: string[]) => keys.some((key) => settingStatus.get(key) === 'configured');
  const readinessItems: Array<{ key: string; label: string; complete: boolean; tab: typeof activeTab; action: string }> = [
    { key: 'products', label: 'Add at least one artwork for sale', complete: safeStats.totalProducts > 0, tab: 'products', action: 'Open products' },
    { key: 'portfolio', label: 'Build the public portfolio', complete: safeStats.totalArtworks > 0, tab: 'portfolio', action: 'Open portfolio' },
    { key: 'blog', label: 'Publish at least one blog post', complete: safeStats.publishedPosts > 0, tab: 'posts', action: 'Open posts' },
    { key: 'payments', label: 'Configure Stripe checkout', complete: hasAnyConfigured(['STRIPE_SECRET_KEY']) && hasAnyConfigured(['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']), tab: 'settings', action: 'Open settings' },
    { key: 'email', label: 'Configure contact and email delivery', complete: hasAnyConfigured(['CONTACT_EMAIL', 'SMTP_FROM', 'SMTP_USER']) && hasAnyConfigured(['EMAIL_DELIVERY_MODE']), tab: 'settings', action: 'Open settings' },
    { key: 'marketing', label: 'Connect or prepare marketing channels', complete: hasAnyConfigured(['NEWSLETTER_DELIVERY_MODE', 'SOCIAL_PUBLISH_MODE', 'NEXT_PUBLIC_GA4_MEASUREMENT_ID']), tab: 'marketing', action: 'Open marketing' },
  ];
  const incompleteReadinessItems = readinessItems.filter((item) => !item.complete);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.replace('/auth/signin');
      return;
    }

    if (!session.user.isAdmin) {
      router.replace('/');
    }
  }, [router, session, status]);

  // Check authentication
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!session.user.isAdmin) {
    return null;
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {incompleteReadinessItems.length > 0 && !settingsError && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold text-blue-950">Launch readiness</h2>
          <p className="mt-1 text-sm text-blue-900">
            Complete these items from this dashboard before launch. No code changes are required.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {incompleteReadinessItems.map((item) => (
              <button key={item.key} type="button" onClick={() => setActiveTab(item.tab)} className="rounded border border-blue-200 bg-white px-4 py-3 text-left text-sm font-medium text-blue-950 hover:bg-blue-100">
                <span className="block">{item.label}</span>
                <span className="mt-1 block text-xs font-normal text-blue-700">{item.action}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(statsError || postsError || settingsError) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Some admin data is temporarily unavailable. You can still navigate tabs and continue editing content.
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Posts</p>
              <p className="text-2xl font-semibold text-gray-900">{safeStats.totalPosts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShoppingBag className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Products</p>
              <p className="text-2xl font-semibold text-gray-900">{safeStats.totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Views</p>
              <p className="text-2xl font-semibold text-gray-900">{safeStats.totalViews.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Monthly Views</p>
              <p className="text-2xl font-semibold text-gray-900">{safeStats.monthlyViews.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setActiveTab('posts')}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <FileText className="h-6 w-6 text-gray-400 mr-2" />
            <span className="text-gray-600">Write Post</span>
          </button>
          
          <button onClick={() => setActiveTab('products')} className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
            <Plus className="h-6 w-6 text-gray-400 mr-2" />
            <span className="text-gray-600">Add Product</span>
          </button>
          
          <button onClick={() => setActiveTab('analytics')} className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
            <BarChart3 className="h-6 w-6 text-gray-400 mr-2" />
            <span className="text-gray-600">View Analytics</span>
          </button>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Recent Posts</h3>
        </div>
        <div className="divide-y">
          {safePosts.slice(0, 5).map((post) => (
            <div key={post.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{post.title}</h4>
                <p className="text-sm text-gray-500">
                  {post.status === 'published' ? 'Published' : 'Draft'} • {post.views} views
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Link href={`/blog/${post.slug}`} className="text-gray-400 hover:text-green-600">
                  <Eye size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPosts = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Blog Posts</h2>
      </div>

      {/* Posts List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Views
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {safePosts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{post.title}</div>
                      <div className="text-sm text-gray-500">/{post.slug}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      post.status === 'published' 
                        ? 'bg-green-100 text-green-800'
                        : post.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {post.status}
                    </span>
                    {post.featured && (
                      <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Featured
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {post.views.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Link href={`/blog/${post.slug}`} className="text-green-600 hover:text-green-900">
                        <Eye size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your content and monitor site performance</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'posts', label: 'Blog Posts', icon: FileText },
            { key: 'products', label: 'Products', icon: ShoppingBag },
            { key: 'portfolio', label: 'Portfolio', icon: ImageIcon },
            { key: 'orders', label: 'Orders', icon: ClipboardList },
            { key: 'inventory', label: 'Inventory', icon: Package },
            { key: 'marketing', label: 'Marketing', icon: Megaphone },
            { key: 'analytics', label: 'Analytics', icon: TrendingUp },
            { key: 'settings', label: 'Settings', icon: Settings },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} className="mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'posts' && <AdminContentManager section="posts" />}
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
  );
}