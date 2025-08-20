import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
// Lazy import mdx-bundler inside function to avoid esbuild issues in Jest
const contentDir = path.join(process.cwd(), 'src', 'content', 'blog');
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  tags?: string[];
  isDraft?: boolean;
  coverImage?: string;
  author?: string;
  readingTime?: number;
  category?: string;
  featured?: boolean;
  metaTitle?: string;
  metaDescription?: string;
}
export interface BlogPostWithContent extends BlogPost {
  content: string;
  code: string;
}
export async function getAllPosts(includePages = false): Promise<BlogPost[]> {
  if (!fs.existsSync(contentDir)) {
    return [];
  }
  const files = fs.readdirSync(contentDir);
  const posts = await Promise.all(
    files
      .filter(file => file.endsWith('.mdx'))
      .map(async file => {
        const slug = file.replace(/\.mdx$/, '');
        const filePath = path.join(contentDir, file);
        const source = fs.readFileSync(filePath, 'utf8');
        const { data } = matter(source);
        return {
          slug,
          title: data.title || 'Untitled',
          excerpt: data.excerpt || '',
          publishedAt: data.publishedAt || new Date().toISOString(),
          tags: data.tags || [],
          isDraft: data.isDraft || false,
          coverImage: data.coverImage,
          author: data.author || 'Artist',
          category: data.category || 'general',
          featured: data.featured || false,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
        } as BlogPost;
      })
  );
  // Filter out drafts unless specifically including them
  const filteredPosts = includePages 
    ? posts 
    : posts.filter(post => !post.isDraft);
  // Sort by publishedAt date (newest first)
  return filteredPosts.sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
export async function getPostBySlug(
  slug: string,
  includeDrafts = false,
  options?: { bundle?: boolean }
): Promise<BlogPostWithContent | null> {
  const filePath = path.join(contentDir, `${slug}.mdx`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const source = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(source);
  // Check if post is draft and we're not including drafts
  if (data.isDraft && !includeDrafts) {
    return null;
  }
  try {
    let code = '';
    if (options?.bundle !== false) {
      const { bundleMDX } = await import('mdx-bundler');
      const result = await bundleMDX({
        source,
        mdxOptions(options) {
          options.remarkPlugins = [...(options.remarkPlugins ?? [])];
          options.rehypePlugins = [...(options.rehypePlugins ?? [])];
          return options;
        },
      });
      code = result.code;
    }
    // Build minimal object matching test expectations; include extras only if provided
    const result: BlogPostWithContent = {
      slug,
      title: data.title || 'Untitled',
      excerpt: data.excerpt || '',
      publishedAt: data.publishedAt || new Date().toISOString(),
      tags: data.tags || [],
      isDraft: data.isDraft || false,
      coverImage: data.coverImage,
      author: data.author || 'Artist',
      content,
      code
    };
    // Optionally add fields if explicitly provided
    if (typeof (data as any).category !== 'undefined') {
      (result as BlogPost).category = (data as any).category;
    }
    if (typeof (data as any).featured !== 'undefined') {
      (result as BlogPost).featured = (data as any).featured;
    }
    if (typeof (data as any).metaTitle !== 'undefined') {
      (result as BlogPost).metaTitle = (data as any).metaTitle;
    }
    if (typeof (data as any).metaDescription !== 'undefined') {
      (result as BlogPost).metaDescription = (data as any).metaDescription;
    }
    return result;
  } catch (error) {
    console.error(`Error bundling MDX for ${slug}:`, error);
    return null;
  }
}
export async function getPostSlugs(): Promise<string[]> {
  if (!fs.existsSync(contentDir)) {
    return [];
  }
  const files = fs.readdirSync(contentDir);
  return files
    .filter(file => file.endsWith('.mdx'))
    .map(file => file.replace(/\.mdx$/, ''));
}
