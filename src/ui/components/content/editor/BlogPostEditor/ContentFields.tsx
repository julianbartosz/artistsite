'use client'
import React from 'react'
import { Controller, Control, FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import type { FormInput } from '../schema'
import RichTextEditor from '../RichTextEditor'
import { Calendar, FileText, Tag } from 'lucide-react'

interface Props {
  register: UseFormRegister<FormInput>
  control: Control<FormInput>
  errors: FieldErrors<FormInput>
  setValue: UseFormSetValue<FormInput>
  watch: UseFormWatch<FormInput>
  initialSlug?: string
}

export function ContentFields({ register, control, errors, setValue, watch, initialSlug }: Props) {
  const watchedTitle = watch('title')
  const watchedStatus = watch('status')

  React.useEffect(() => {
    if (watchedTitle && !initialSlug) {
      const slug = watchedTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      setValue('slug', slug)
    }
  }, [watchedTitle, setValue, initialSlug])

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
          <input {...register('title')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Enter post title..." />
          {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Slug *</label>
          <input {...register('slug')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm" placeholder="url-friendly-slug" />
          {errors.slug && <p className="text-red-600 text-sm mt-1">{errors.slug.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Excerpt *</label>
        <textarea {...register('excerpt')} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Brief description of the post..." />
        {errors.excerpt && <p className="text-red-600 text-sm mt-1">{errors.excerpt.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Content *</label>
        <Controller name="content" control={control} render={({ field }) => (
          <RichTextEditor content={field.value} onChange={field.onChange} placeholder="Start writing your blog post..." showPreview maxLength={20000} />
        )} />
        {errors.content && <p className="text-red-600 text-sm mt-1">{errors.content.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2"><Tag size={16} className="inline mr-1" />Tags</label>
          <input {...register('tags')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="tag1, tag2, tag3" />
          <p className="text-gray-500 text-sm mt-1">Separate tags with commas</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
          <select {...register('category')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">Select category</option>
            <option value="art-process">Art Process</option>
            <option value="tutorials">Tutorials</option>
            <option value="inspiration">Inspiration</option>
            <option value="exhibitions">Exhibitions</option>
            <option value="personal">Personal</option>
          </select>
          {errors.category && <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select {...register('status')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        {watchedStatus === 'scheduled' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2"><Calendar size={16} className="inline mr-1" />Publish Date</label>
            <input {...register('publishedAt')} type="datetime-local" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        )}
        <div className="flex items-center">
          <label className="flex items-center">
            <input {...register('featured')} type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="ml-2 text-sm text-gray-700">Featured post</span>
          </label>
        </div>
      </div>
    </>
  )
}
