'use client'
import React from 'react'
import { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { FormInput } from '../schema'

export function SeoFields({ register, errors }: { register: UseFormRegister<FormInput>; errors: FieldErrors<FormInput> }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Meta Title</label>
        <input {...register('metaTitle')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="SEO-optimized title (optional)" />
        <p className="text-gray-500 text-sm mt-1">If empty, the post title will be used. Max 60 characters.</p>
        {errors.metaTitle && <p className="text-red-600 text-sm mt-1">{errors.metaTitle.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Meta Description</label>
        <textarea {...register('metaDescription')} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="SEO description for search engines (optional)" />
        <p className="text-gray-500 text-sm mt-1">If empty, the excerpt will be used. Max 160 characters.</p>
        {errors.metaDescription && <p className="text-red-600 text-sm mt-1">{errors.metaDescription.message}</p>}
      </div>
    </>
  )
}
