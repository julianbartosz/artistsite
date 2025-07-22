'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import RichTextEditor from './RichTextEditor';
import { Save, Eye, Calendar, Tag, Globe, FileText } from 'lucide-react';

// Validation schema - make tags and featured required to match form interface
const blogPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
  excerpt: z.string().min(1, 'Excerpt is required').max(500, 'Excerpt too long'),
  content: z.string().min(1, 'Content is required'),
  tags: z.array(z.string()),
  category: z.string().min(1, 'Category is required'),
  publishedAt: z.string().optional(),
  status: z.enum(['draft', 'published', 'scheduled']),
  featured: z.boolean(),
  metaTitle: z.string().max(60, 'Meta title too long').optional(),
  metaDescription: z.string().max(160, 'Meta description too long').optional(),
});

type BlogPostFormData = z.infer<typeof blogPostSchema>;

interface BlogPostEditorProps {
  initialData?: Partial<BlogPostFormData>;
  onSave?: (data: BlogPostFormData) => Promise<void>;
  onPreview?: (data: BlogPostFormData) => void;
  isLoading?: boolean;
}

export default function BlogPostEditor({
  initialData,
  onSave,
  onPreview,
  isLoading = false
}: BlogPostEditorProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'seo'>('content');
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<BlogPostFormData>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: {
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      category: '',
      status: 'draft',
      featured: false,
      tags: [],
      publishedAt: undefined,
      metaTitle: undefined,
      metaDescription: undefined,
      ...initialData
    }
  });

  const watchedTitle = watch('title');
  const watchedStatus = watch('status');

  // Auto-generate slug from title
  React.useEffect(() => {
    if (watchedTitle && !initialData?.slug) {
      const slug = watchedTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setValue('slug', slug);
    }
  }, [watchedTitle, setValue, initialData?.slug]);

  const onSubmit = async (data: BlogPostFormData) => {
    if (onSave) {
      await onSave(data);
    }
  };

  const handlePreview = () => {
    const currentData = watch();
    if (onPreview) {
      onPreview(currentData);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {initialData ? 'Edit Blog Post' : 'Create New Blog Post'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {isDirty && 'You have unsaved changes'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handlePreview}
              className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              <Eye size={16} className="mr-2" />
              Preview
            </button>
            <button
              type="submit"
              form="blog-post-form"
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={16} className="mr-2" />
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`py-4 text-sm font-medium border-b-2 ${
              activeTab === 'content'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} className="inline mr-2" />
            Content
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('seo')}
            className={`py-4 text-sm font-medium border-b-2 ${
              activeTab === 'seo'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe size={16} className="inline mr-2" />
            SEO & Meta
          </button>
        </nav>
      </div>

      <form id="blog-post-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="p-6 space-y-6">
          {activeTab === 'content' && (
            <>
              {/* Title & Slug */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    {...register('title')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter post title..."
                  />
                  {errors.title && (
                    <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Slug *
                  </label>
                  <input
                    {...register('slug')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="url-friendly-slug"
                  />
                  {errors.slug && (
                    <p className="text-red-600 text-sm mt-1">{errors.slug.message}</p>
                  )}
                </div>
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Excerpt *
                </label>
                <textarea
                  {...register('excerpt')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of the post..."
                />
                {errors.excerpt && (
                  <p className="text-red-600 text-sm mt-1">{errors.excerpt.message}</p>
                )}
              </div>

              {/* Content Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content *
                </label>
                <Controller
                  name="content"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      content={field.value}
                      onChange={field.onChange}
                      placeholder="Start writing your blog post..."
                      showPreview
                      maxLength={20000}
                    />
                  )}
                />
                {errors.content && (
                  <p className="text-red-600 text-sm mt-1">{errors.content.message}</p>
                )}
              </div>

              {/* Tags & Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag size={16} className="inline mr-1" />
                    Tags
                  </label>
                  <input
                    {...register('tags')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="tag1, tag2, tag3"
                  />
                  <p className="text-gray-500 text-sm mt-1">Separate tags with commas</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    {...register('category')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    <option value="art-process">Art Process</option>
                    <option value="tutorials">Tutorials</option>
                    <option value="inspiration">Inspiration</option>
                    <option value="exhibitions">Exhibitions</option>
                    <option value="personal">Personal</option>
                  </select>
                  {errors.category && (
                    <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>
                  )}
                </div>
              </div>

              {/* Publishing Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    {...register('status')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                {watchedStatus === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar size={16} className="inline mr-1" />
                      Publish Date
                    </label>
                    <input
                      {...register('publishedAt')}
                      type="datetime-local"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      {...register('featured')}
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Featured post</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === 'seo' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Title
                </label>
                <input
                  {...register('metaTitle')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="SEO-optimized title (optional)"
                />
                <p className="text-gray-500 text-sm mt-1">
                  If empty, the post title will be used. Max 60 characters.
                </p>
                {errors.metaTitle && (
                  <p className="text-red-600 text-sm mt-1">{errors.metaTitle.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Description
                </label>
                <textarea
                  {...register('metaDescription')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="SEO description for search engines (optional)"
                />
                <p className="text-gray-500 text-sm mt-1">
                  If empty, the excerpt will be used. Max 160 characters.
                </p>
                {errors.metaDescription && (
                  <p className="text-red-600 text-sm mt-1">{errors.metaDescription.message}</p>
                )}
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
}