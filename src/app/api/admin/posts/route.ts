import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { getAllPosts } from '@domain/content';
import matter from 'gray-matter';

// Remove mock data - we'll use real MDX files
const contentDir = join(process.cwd(), 'src', 'content', 'blog');

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all posts including drafts for admin view
    const posts = await getAllPosts(true);
    
    // Transform to match admin dashboard expectations
    const adminPosts = posts.map(post => ({
      id: post.slug, // Use slug as ID for consistency
      title: post.title,
      slug: post.slug,
      status: post.isDraft ? 'draft' : 'published',
      publishedAt: post.publishedAt,
      views: 0, // TODO: Implement view tracking
      featured: post.featured || false,
      category: post.category || 'general',
      tags: post.tags || [],
    }));

    return json(adminPosts, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    // Using proper error logging would be better than console in production
    console.error('Posts API error:', error);
    return json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.content || !data.slug) {
      return json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create MDX frontmatter
    const frontmatter = {
      title: data.title,
      excerpt: data.excerpt || '',
      publishedAt: new Date().toISOString(),
      isDraft: data.status !== 'published',
      tags: data.tags || [],
      author: session.user.name || 'Artist',
      category: data.category || 'general',
      featured: data.featured || false,
      metaTitle: data.metaTitle || data.title,
      metaDescription: data.metaDescription || data.excerpt || '',
    };

    // Create MDX content with frontmatter
    const mdxContent = matter.stringify(data.content, frontmatter);

    // Save as MDX file
    try {
      const filePath = join(contentDir, `${data.slug}.mdx`);
      await writeFile(filePath, mdxContent, 'utf8');
    } catch (fileError) {
      console.error('Could not save MDX file:', fileError);
      return json(
        { error: 'Failed to save blog post' },
        { status: 500 }
      );
    }

    // Create response post object
    const newPost = {
      id: data.slug,
      slug: data.slug,
      title: data.title,
      status: data.status,
      publishedAt: frontmatter.publishedAt,
      views: 0,
      featured: frontmatter.featured,
      category: frontmatter.category,
      tags: frontmatter.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return json({ 
      success: true, 
      post: newPost 
    }, { status: 201 });

  } catch (error) {
    console.error('Create post error:', error);
    return json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}