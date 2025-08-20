'use client'
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, Eye, FileText, Globe } from 'lucide-react'
import { blogPostFormSchema, type BlogPostFormData, type FormInput } from '../schema'
import { ContentFields } from './ContentFields'
import { SeoFields } from './SeoFields'

interface BlogPostEditorProps {
  initialData?: Partial<BlogPostFormData>
  onSave?: (data: BlogPostFormData) => Promise<void>
  onPreview?: (data: BlogPostFormData) => void
  isLoading?: boolean
}

export default function BlogPostEditor({ initialData, onSave, onPreview, isLoading = false }: BlogPostEditorProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'seo'>('content')

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isDirty } } = useForm<FormInput>({
    resolver: zodResolver(blogPostFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      slug: initialData?.slug || '',
      excerpt: initialData?.excerpt || '',
      content: initialData?.content || '',
      category: initialData?.category || '',
      status: initialData?.status || 'draft',
      featured: initialData?.featured ?? false,
      tags: initialData?.tags ? (Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '') : '',
      publishedAt: initialData?.publishedAt || undefined,
      metaTitle: initialData?.metaTitle || undefined,
      metaDescription: initialData?.metaDescription || undefined
    }
  })

  const submit = async (data: FormInput) => {
    if (!onSave) return
    const apiData: BlogPostFormData = { ...data, tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] }
    await onSave(apiData)
  }

  const handlePreview = () => {
    if (!onPreview) return
    const current = watch()
    const previewData: BlogPostFormData = { ...current, tags: current.tags ? current.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] }
    onPreview(previewData)
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{initialData ? 'Edit Blog Post' : 'Create New Blog Post'}</h2>
            <p className="text-sm text-gray-600 mt-1">{isDirty && 'You have unsaved changes'}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button type="button" onClick={handlePreview} className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
              <Eye size={16} className="mr-2" />
              Preview
            </button>
            <button type="submit" form="blog-post-form" disabled={isLoading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              <Save size={16} className="mr-2" />
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="border-b">
        <nav className="flex space-x-8 px-6">
          <button type="button" onClick={() => setActiveTab('content')} className={`py-4 text-sm font-medium border-b-2 ${activeTab === 'content' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <FileText size={16} className="inline mr-2" />
            Content
          </button>
          <button type="button" onClick={() => setActiveTab('seo')} className={`py-4 text-sm font-medium border-b-2 ${activeTab === 'seo' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Globe size={16} className="inline mr-2" />
            SEO & Meta
          </button>
        </nav>
      </div>

      <form id="blog-post-form" onSubmit={handleSubmit(submit)}>
        <div className="p-6 space-y-6">
          {activeTab === 'content' ? (
            <ContentFields register={register} control={control} errors={errors} setValue={setValue} watch={watch} initialSlug={initialData?.slug} />
          ) : (
            <SeoFields register={register} errors={errors} />
          )}
        </div>
      </form>
    </div>
  )
}
