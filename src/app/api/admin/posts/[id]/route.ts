import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { getPostBySlug } from '@domain/content';
import matter from 'gray-matter';

const contentDir = join(process.cwd(), 'src', 'content', 'blog');

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const data = await request.json();

    const existingPost = await getPostBySlug(id, true, { bundle: false });
    if (!existingPost) return json({ error: 'Post not found' }, { status: 404 });

    const frontmatter = {
      title: data.title || existingPost.title,
      excerpt: data.excerpt || existingPost.excerpt,
      publishedAt: data.status === 'published' ? new Date().toISOString() : existingPost.publishedAt,
      isDraft: data.status ? data.status !== 'published' : existingPost.isDraft,
      tags: data.tags || existingPost.tags || [],
      author: existingPost.author || session.user.name || 'Artist',
      category: data.category || 'general',
      featured: data.featured !== undefined ? data.featured : false,
      metaTitle: data.metaTitle || data.title || existingPost.title,
      metaDescription: data.metaDescription || data.excerpt || existingPost.excerpt,
    };

    const mdxContent = matter.stringify(data.content || existingPost.content, frontmatter);

    const filePath = join(contentDir, `${id}.mdx`);
    await writeFile(filePath, mdxContent, 'utf8');

    const updatedPost = {
      id,
      slug: id,
      title: frontmatter.title,
      status: frontmatter.isDraft ? 'draft' : 'published',
      publishedAt: frontmatter.publishedAt,
      views: 0,
      featured: frontmatter.featured,
      category: frontmatter.category,
      tags: frontmatter.tags,
      updatedAt: new Date().toISOString(),
    };

    return json({ success: true, post: updatedPost });

  } catch (error) {
    console.error('Update post error:', error);
    return json({ error: 'Failed to update post' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;

    const existingPost = await getPostBySlug(id, true, { bundle: false });
    if (!existingPost) return json({ error: 'Post not found' }, { status: 404 });

    const filePath = join(contentDir, `${id}.mdx`);
    await unlink(filePath);

    return json({ success: true, message: 'Post deleted successfully' });

  } catch (error) {
    console.error('Delete post error:', error);
    return json({ error: 'Failed to delete post' }, { status: 500 });
  }
}