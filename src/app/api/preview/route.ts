import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { getPostBySlug } from '@/lib/markdown';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const slug = searchParams.get('slug');

  // Check the secret and next parameters
  if (secret !== process.env.PREVIEW_SECRET || !slug) {
    return new Response('Invalid token or missing slug', { status: 401 });
  }

  // Verify the post exists and is a draft
  const post = await getPostBySlug(slug, true); // Include drafts
  
  if (!post) {
    return new Response('Post not found', { status: 404 });
  }

  if (!post.isDraft) {
    // If post is already published, redirect to public version
    redirect(`/blog/${slug}`);
  }

  // Enable Draft Mode
  const draft = await draftMode();
  draft.enable();

  // Redirect to the blog post in preview mode
  redirect(`/blog/${slug}`);
}

// Disable preview mode
export async function DELETE() {
  const draft = await draftMode();
  draft.disable();
  redirect('/blog');
}
