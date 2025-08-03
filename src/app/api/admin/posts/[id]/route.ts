import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { getPostBySlug } from '@/lib/markdown';
import matter from 'gray-matter';

const contentDir = join(process.cwd(), 'src', 'content', 'blog');

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();
    
    // Get existing post
    const existingPost = await getPostBySlug(id, true);
    if (!existingPost) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Update frontmatter
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

    // Create updated MDX content
    const mdxContent = matter.stringify(data.content || existingPost.content, frontmatter);

    // Save updated MDX file
    const filePath = join(contentDir, `${id}.mdx`);
    await writeFile(filePath, mdxContent, 'utf8');

    const updatedPost = {
      id: id,
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

    return NextResponse.json({ 
      success: true, 
      post: updatedPost 
    });

  } catch (error) {
    console.error('Update post error:', error);
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Check if post exists
    const existingPost = await getPostBySlug(id, true);
    if (!existingPost) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Delete the MDX file
    const filePath = join(contentDir, `${id}.mdx`);
    await unlink(filePath);

    return NextResponse.json({ 
      success: true, 
      message: 'Post deleted successfully' 
    });

  } catch (error) {
    console.error('Delete post error:', error);
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}