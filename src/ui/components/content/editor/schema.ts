import { z } from 'zod'

export const blogPostFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
  excerpt: z.string().min(1, 'Excerpt is required').max(500, 'Excerpt too long'),
  content: z.string().min(1, 'Content is required'),
  tags: z.string(),
  category: z.string().min(1, 'Category is required'),
  publishedAt: z.string().optional(),
  status: z.enum(['draft', 'published', 'scheduled']),
  featured: z.boolean(),
  metaTitle: z.string().max(60, 'Meta title too long').optional(),
  metaDescription: z.string().max(160, 'Meta description too long').optional()
})

export type FormInput = z.infer<typeof blogPostFormSchema>

export interface BlogPostFormData {
  title: string
  slug: string
  excerpt: string
  content: string
  tags: string[]
  category: string
  publishedAt?: string
  status: 'draft' | 'published' | 'scheduled'
  featured: boolean
  metaTitle?: string
  metaDescription?: string
}
