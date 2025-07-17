import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { getPostBySlug } from '@/lib/markdown';
import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';

export const GET = withApiErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const slug = searchParams.get('slug');

  // Check the secret and next parameters
  if (secret !== process.env.PREVIEW_SECRET || !slug) {
    throw new ApiError(401, 'Invalid token or missing slug', 'INVALID_PREVIEW_TOKEN');
  }

  // Verify the post exists and is a draft
  const post = await getPostBySlug(slug, true); // Include drafts
  
  if (!post) {
    throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
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
});

// Disable preview mode
export const DELETE = withApiErrorHandler(async () => {
  const draft = await draftMode();
  draft.disable();
  redirect('/blog');
});
