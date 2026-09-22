import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';
import { db } from '@/lib/db';
import { UPDATES_PATH, updatesPostPath } from '@/lib/site-content-shared';

export const GET = withApiErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const slug = searchParams.get('slug');

  // Check the secret and next parameters
  if (secret !== process.env.PREVIEW_SECRET || !slug) {
    throw new ApiError(401, 'Invalid token or missing slug', 'INVALID_PREVIEW_TOKEN');
  }

  const post = await db.blogPost.findUnique({
    where: { slug },
    select: { slug: true, isDraft: true },
  });

  if (!post) {
    throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  if (!post.isDraft) {
    redirect(updatesPostPath(slug));
  }

  // Enable Draft Mode
  const draft = await draftMode();
  draft.enable();

  // Redirect to the update in preview mode
  redirect(updatesPostPath(slug));
});

// Disable preview mode
export const DELETE = withApiErrorHandler(async () => {
  const draft = await draftMode();
  draft.disable();
  redirect(UPDATES_PATH);
});
