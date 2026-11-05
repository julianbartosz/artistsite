/** @jest-environment node */

import { POST as contactPost } from '@/app/api/contact/route';
import { POST as newsletterPost } from '@/app/api/newsletter/route';
import { POST as commissionPost } from '@/app/api/commission/route';
import { GET as previewGet, DELETE as previewDelete } from '@/app/api/preview/route';
import { NextRequest } from 'next/server';
import { safeCallbackUrl, destinationAfterSignIn } from '@/app/auth/signin/SignInForm';
import { linkContactSubmissionToInbox } from '@/lib/studio-inbox';
import { getConfig } from '@/lib/config';
import { POST as engagementPost } from '@/app/api/updates/[slug]/engagement/route';
import { getServerSession } from 'next-auth';
import { getSiteContent } from '@/lib/site-content';
import { addPostComment, removeOwnComment, setPostLike } from '@/lib/update-engagement';

jest.mock('@/lib/db', () => ({
  db: {
    blogPost: {
      findUnique: jest.fn(async ({ where }: { where: { slug: string } }) => (
        where.slug === 'test-post'
          ? { slug: 'test-post', isDraft: true }
          : null
      )),
    },
    analyticsEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: '1' }),
    },
    contactSubmission: {
      create: jest.fn().mockResolvedValue({ id: '1' }),
    },
    newsletterSubscriber: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: '1', email: 'subscriber@example.com' }),
      upsert: jest.fn().mockResolvedValue({ id: '1', email: 'subscriber@example.com' }),
    },
    customerProfile: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: '1', email: 'subscriber@example.com' }),
    },
  },
}));

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/email', () => ({
  sendTemplateEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/studio-inbox', () => ({
  linkContactSubmissionToInbox: jest.fn().mockResolvedValue({ id: 'thread-1' }),
}));

jest.mock('next/headers', () => ({
  draftMode: jest.fn(async () => ({
    enable: jest.fn(),
    disable: jest.fn(),
  })),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    const error = new Error('NEXT_REDIRECT') as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;307;${url}`;
    throw error;
  }),
}));

jest.mock('@/lib/markdown', () => ({
  getPostBySlug: jest.fn().mockResolvedValue({ isDraft: true, slug: 'test-post' }),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/auth', () => {
  const { ApiError } = jest.requireActual('@/lib/api-error-handler');
  const { getServerSession } = jest.requireMock('next-auth');
  return {
    authOptions: {},
    requireUser: jest.fn(async () => {
      const session = await getServerSession();
      if (!session?.user?.id) throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
      return session;
    }),
  };
});

jest.mock('@/lib/site-content', () => ({
  getSiteContent: jest.fn(),
}));

jest.mock('@/lib/update-engagement', () => ({
  addPostComment: jest.fn(async ({ body }: { body: string }) => ({
    id: 'comment-1', body, authorName: 'Collector', createdAt: new Date(0).toISOString(), canRemove: true,
  })),
  countVisibleComments: jest.fn().mockResolvedValue(1),
  getPostEngagement: jest.fn(),
  readGuestSessionId: jest.fn().mockResolvedValue('guest_1'),
  removeOwnComment: jest.fn().mockResolvedValue(undefined),
  resolveGuestSessionId: jest.fn().mockResolvedValue('guest_1'),
  setPostLike: jest.fn(async (_slug: string, _viewer: unknown, liked: boolean) => ({ liked, likeCount: liked ? 1 : 0 })),
}));

jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'warn').mockImplementation();

describe('API Integration Tests', () => {
  describe('Contact API', () => {
    it('should handle valid contact form submission', async () => {
      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Test inquiry',
          message: 'This is a test message for the contact form.',
          inquiryType: 'general',
        }),
        headers: { 'Content-Type': 'application/json', 'x-e2e-test': 'true' },
      });

      const response = await contactPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Message sent successfully!');
      expect(data.inquiryType).toBe('general');
      expect(linkContactSubmissionToInbox).toHaveBeenCalled();
    });

    it('should reject invalid contact form data', async () => {
      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          email: 'invalid-email',
          subject: '',
          message: 'short',
        }),
        headers: { 'Content-Type': 'application/json', 'x-e2e-test': 'true' },
      });

      expect((await contactPost(request)).status).toBe(400);
    });
  });

  describe('Newsletter API', () => {
    it('should handle valid newsletter subscription', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: 'subscriber@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await newsletterPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Successfully subscribed to newsletter!');
      expect(data.email).toBe('subscriber@example.com');
      expect(data.mode).toBe('development');
    });

    it('should reject invalid email addresses', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect((await newsletterPost(request)).status).toBe(400);
    });

    it('should reject missing email', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect((await newsletterPost(request)).status).toBe(400);
    });
  });

  describe('Commission API', () => {
    beforeEach(() => {
      (getConfig as jest.Mock).mockImplementation(async (key: string) => (
        key === 'ARTIST_EMAIL' || key === 'CONTACT_EMAIL' ? 'artist@example.com' : null
      ));
      (linkContactSubmissionToInbox as jest.Mock).mockClear();
    });

    afterEach(() => {
      (getConfig as jest.Mock).mockResolvedValue(null);
    });

    it('persists commission requests to the studio inbox', async () => {
      const request = new NextRequest('http://localhost:3000/api/commission', {
        method: 'POST',
        body: JSON.stringify({
          type: 'custom',
          medium: 'Oil',
          dimensions: '24x36',
          description: 'A custom portrait commission with detailed notes for the studio.',
          timeline: '8 weeks',
          budget: { min: 500, max: 1200 },
          customerInfo: {
            name: 'Collector',
            email: 'collector@example.com',
            preferredContact: 'email',
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await commissionPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(linkContactSubmissionToInbox).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'collector@example.com',
          inquiryType: 'commission',
        }),
      );
    });
  });

  describe('Update engagement API', () => {
    const member = { user: { id: 'user-1', email: 'member@example.com', isAdmin: false } };

    function engage(payload: unknown) {
      return engagementPost(
        new NextRequest('http://localhost:3000/api/updates/test-post/engagement', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: Promise.resolve({ slug: 'test-post' }) },
      );
    }

    beforeEach(() => {
      jest.clearAllMocks();
      (getSiteContent as jest.Mock).mockResolvedValue({ showLikes: true, showComments: true });
      (getServerSession as jest.Mock).mockResolvedValue(null);
    });

    it.each([
      { name: 'guest like', session: null, payload: { action: 'like', liked: true }, status: 200 },
      { name: 'repeat like stays liked', session: member, payload: { action: 'like', liked: true }, status: 200 },
      { name: 'unlike', session: member, payload: { action: 'like', liked: false }, status: 200 },
      { name: 'like without desired state', session: null, payload: { action: 'like' }, status: 400 },
      { name: 'guest comment', session: null, payload: { action: 'comment', body: 'Lovely' }, status: 401 },
      { name: 'blank comment', session: member, payload: { action: 'comment', body: '   ' }, status: 400 },
      { name: 'member comment', session: member, payload: { action: 'comment', body: '  Lovely work  ' }, status: 201 },
      { name: 'member withdraws comment', session: member, payload: { action: 'remove_comment', commentId: 'comment-1' }, status: 200 },
      { name: 'likes turned off', session: null, payload: { action: 'like', liked: true }, status: 403, blog: { showLikes: false } },
      { name: 'comments turned off', session: member, payload: { action: 'comment', body: 'Hi' }, status: 403, blog: { showComments: false } },
    ])('$name -> $status', async ({ session, payload, status, blog }) => {
      (getServerSession as jest.Mock).mockResolvedValue(session);
      if (blog) (getSiteContent as jest.Mock).mockResolvedValue({ showLikes: true, showComments: true, ...blog });

      const response = await engage(payload);

      expect(response.status).toBe(status);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    });

    it('routes each action to the viewer-scoped engagement helper', async () => {
      await engage({ action: 'like', liked: true });
      expect(setPostLike).toHaveBeenCalledWith('test-post', { userId: null, sessionId: 'guest_1' }, true);

      (getServerSession as jest.Mock).mockResolvedValue(member);
      await engage({ action: 'comment', body: '  Lovely work  ' });
      expect(addPostComment).toHaveBeenCalledWith({ postSlug: 'test-post', userId: 'user-1', body: 'Lovely work' });

      await engage({ action: 'remove_comment', commentId: 'comment-1' });
      expect(removeOwnComment).toHaveBeenCalledWith({ postSlug: 'test-post', commentId: 'comment-1', userId: 'user-1' });
    });
  });

  describe('Preview API', () => {
    const originalEnv = process.env.PREVIEW_SECRET;

    beforeAll(() => {
      process.env.PREVIEW_SECRET = 'test-secret-123';
    });

    afterAll(() => {
      process.env.PREVIEW_SECRET = originalEnv;
    });

    it('should enable preview mode with valid secret', async () => {
      const request = new NextRequest('http://localhost:3000/api/preview?secret=test-secret-123&slug=test-post');
      await expect(previewGet(request)).rejects.toMatchObject({
        digest: expect.stringContaining('NEXT_REDIRECT'),
      });
    });

    it('should reject invalid preview secret', async () => {
      const request = new NextRequest('http://localhost:3000/api/preview?secret=wrong-secret&slug=test-post');
      expect((await previewGet(request)).status).toBe(401);
    });

    it('should disable preview mode', async () => {
      await expect(previewDelete()).rejects.toMatchObject({
        digest: expect.stringContaining('NEXT_REDIRECT'),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: 'invalid json{',
        headers: { 'Content-Type': 'application/json', 'x-e2e-test': 'true' },
      });

      expect((await contactPost(request)).status).toBe(400);
    });

    it('should handle missing content-type header', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await newsletterPost(request);
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});

describe('SignInForm helpers', () => {
  it.each([
    [null, '/account'],
    ['%2Faccount', '/account'],
    ['/shop', '/shop'],
    ['//evil.com', '/account'],
    ['https://evil.com', '/account'],
    ['/\\evil.com', '/account'],
    ['%2Fupdates%2Fa-post%23comments', '/updates/a-post'],
    ['/updates?view=collectors&kind=short#top', '/updates?view=collectors&kind=short'],
  ])('safeCallbackUrl(%p) -> %p', (input, expected) => {
    expect(safeCallbackUrl(input)).toBe(expected);
  });

  it.each([
    ['/account', false, '/account'],
    ['/account', true, '/admin'],
    ['/shop', false, '/shop'],
    ['/shop', true, '/shop'],
  ])('destinationAfterSignIn(%p, admin=%p) -> %p', (requested, isAdmin, expected) => {
    expect(destinationAfterSignIn(requested, isAdmin)).toBe(expected);
  });
});
