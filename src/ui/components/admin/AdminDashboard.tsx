'use client';
// Moved from app/admin/AdminDashboard.tsx as part of Phase 1 layering refactor
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import useSWR from 'swr';
import { BlogPostEditor } from '@ui/components/content';
import { type BlogPostFormData } from '@ui/components/content/editor/schema';
import { 
  FileText, 
  ShoppingBag, 
  BarChart3, 
  Plus, 
  Edit, 
  Trash2,
  Eye,
  Calendar,
  TrendingUp
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface DashboardStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalProducts: number;
  totalViews: number;
  monthlyViews: number;
}
interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: string;
  views: number;
  featured: boolean;
}
interface BlogPostInput {
  title: string;
  slug: string;
  content?: string;
  status?: 'draft' | 'published' | 'scheduled';
  featured?: boolean;
  [key: string]: unknown;
}
export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'products' | 'analytics'>('overview');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const { data: stats } = useSWR<DashboardStats>('/api/admin/stats', fetcher);
  const { data: posts, mutate: mutatePosts } = useSWR<BlogPost[]>('/api/admin/posts', fetcher);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!session) redirect('/auth/signin');

  const handleSaveBlogPost = async (data: BlogPostFormData) => {
    try {
      const url = editingPost ? `/api/admin/posts/${editingPost.id}` : '/api/admin/posts';
      const method = editingPost ? 'PATCH' : 'POST';
      // Convert data to API shape if necessary (currently identical)
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (response.ok) {
        await mutatePosts();
        setIsCreatingPost(false);
        setEditingPost(null);
        alert(editingPost ? 'Post updated successfully!' : 'Post created successfully!');
      } else throw new Error('Failed to save post');
    } catch (error) {
      /* error intentionally swallowed; replace with logger */
      alert('Failed to save post. Please try again.');
    }
  };
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      const response = await fetch(`/api/admin/posts/${postId}`, { method: 'DELETE' });
      if (response.ok) {
        await mutatePosts();
        alert('Post deleted successfully!');
      } else throw new Error('Failed to delete post');
    } catch (error) {
      /* error intentionally swallowed; replace with logger */
      alert('Failed to delete post. Please try again.');
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[{
          icon: FileText, label: 'Total Posts', value: stats?.totalPosts || 0, color: 'text-blue-600'
        }, {
          icon: ShoppingBag, label: 'Products', value: stats?.totalProducts || 0, color: 'text-green-600'
        }, {
          icon: TrendingUp, label: 'Total Views', value: stats?.totalViews?.toLocaleString() || 0, color: 'text-purple-600'
        }, {
          icon: Calendar, label: 'Monthly Views', value: stats?.monthlyViews?.toLocaleString() || 0, color: 'text-orange-600'
        }].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <Icon className={`h-8 w-8 ${color}`} />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-2xl font-semibold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => setIsCreatingPost(true)} className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
            <Plus className="h-6 w-6 text-gray-400 mr-2" />
            <span className="text-gray-600">Create New Post</span>
          </button>
          <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
            <Plus className="h-6 w-6 text-gray-400 mr-2" />
            <span className="text-gray-600">Add Product</span>
          </button>
          <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
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
          {posts?.slice(0, 5).map(post => (
            <div key={post.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{post.title}</h4>
                <p className="text-sm text-gray-500">
                  {post.status === 'published' ? 'Published' : 'Draft'} • {post.views} views
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => setEditingPost(post)} className="text-gray-400 hover:text-blue-600"><Edit size={16} /></button>
                <button className="text-gray-400 hover:text-green-600"><Eye size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPosts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Blog Posts</h2>
        <button onClick={() => setIsCreatingPost(true)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          <Plus size={16} className="mr-2" /> New Post
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Title','Status','Views','Date','Actions'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {posts?.map(post => (
              <tr key={post.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{post.title}</div>
                  <div className="text-sm text-gray-500">/{post.slug}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    post.status === 'published' ? 'bg-green-100 text-green-800' : post.status === 'scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>{post.status}</span>
                  {post.featured && <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Featured</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{post.views.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => setEditingPost(post)} className="text-blue-600 hover:text-blue-900"><Edit size={16} /></button>
                    <button className="text-green-600 hover:text-green-900"><Eye size={16} /></button>
                    <button onClick={() => handleDeletePost(post.id)} className="text-red-600 hover:text-red-900"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isCreatingPost || editingPost) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button onClick={() => { setIsCreatingPost(false); setEditingPost(null); }} className="text-blue-600 hover:text-blue-800">← Back to Dashboard</button>
        </div>
        <BlogPostEditor initialData={editingPost || undefined} onSave={handleSaveBlogPost} isLoading={false} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your content and monitor site performance</p>
      </div>
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'posts', label: 'Blog Posts', icon: FileText },
            { key: 'products', label: 'Products', icon: ShoppingBag },
            { key: 'analytics', label: 'Analytics', icon: TrendingUp },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as any)} className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              <Icon size={16} className="mr-2" />{label}
            </button>
          ))}
        </nav>
      </div>
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'posts' && renderPosts()}
      {activeTab === 'products' && <div className="text-center py-12"><p className="text-gray-500">Product management coming soon...</p></div>}
      {activeTab === 'analytics' && <div className="text-center py-12"><p className="text-gray-500">Analytics dashboard coming soon...</p></div>}
    </div>
  );
}
