/** @jest-environment node */

import { POST as contactPost } from '@/app/api/contact/route';
import { POST as newsletterPost } from '@/app/api/newsletter/route';
import { POST as commissionPost } from '@/app/api/commission/route';
import { POST as eventsPost } from '@/app/api/events/route';
import { GET as previewGet, DELETE as previewDelete } from '@/app/api/preview/route';
import { NextRequest } from 'next/server';
import { authErrorMessage, safeCallbackUrl, destinationAfterSignIn } from '@/app/auth/signin/SignInForm';
import { CustomerInsights, shouldIgnoreAnalyticsPageUrl } from '@/lib/analytics/customer-insights';
import { linkContactSubmissionToInbox } from '@/lib/studio-inbox';
import { getConfig } from '@/lib/config';
import { sendTemplateEmail } from '@/lib/email';
import { POST as engagementPost } from '@/app/api/updates/[slug]/engagement/route';
import { GET as monitoringSecurityGet } from '@/app/api/monitoring/security/route';
import { POST as monitoringPerformancePost } from '@/app/api/monitoring/performance/route';
import { GET as performanceGet } from '@/app/api/performance/route';
import { getServerSession } from 'next-auth';
import { getSiteContent } from '@/lib/site-content';
import { addPostComment, removeOwnComment, setPostLike } from '@/lib/update-engagement';
import { db } from '@/lib/db';

jest.mock('@/lib/db', () => {
  const mockClient = {
    blogPost: {
      findUnique: jest.fn(async ({ where }: { where: { slug: string } }) => (
        where.slug === 'test-post'
          ? { slug: 'test-post', isDraft: true }
          : null
      )),
    },
    analyticsEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: '1' }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    contactSubmission: {
      create: jest.fn().mockResolvedValue({ id: '1' }),
    },
    newsletterSubscriber: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: '1', email: 'subscriber@example.com' }),
      upsert: jest.fn().mockResolvedValue({ id: '1', email: 'subscriber@example.com' }),
    },
    customerProfile: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: '1', email: 'subscriber@example.com' }),
    },
  };
  return { db: mockClient, prisma: mockClient };
});

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/email', () => ({
  ...jest.requireActual('@/lib/email'),
  sendTemplateEmail: jest.fn().mockResolvedValue(true),
  getEmailBrand: jest.fn().mockResolvedValue({ siteName: 'Studio', siteUrl: 'https://studio.example', primaryColor: '#1a3a82' }),
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
    requireAdmin: jest.fn(async () => {
      const session = await getServerSession();
      if (!session?.user?.isAdmin) throw new ApiError(401, 'Admin required', 'UNAUTHORIZED');
      return session;
    }),
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
          name: 'John <b>Doe</b>',
          email: 'john@example.com',
          subject: 'Test inquiry',
          message: 'This is a test message <script>alert(1)</script> for the contact form.',
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
      const [, template, options] = (sendTemplateEmail as jest.Mock).mock.calls.at(-1);
      expect(template.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(template.html).not.toContain('<b>Doe</b>');
      expect(template.html).toContain('#1a3a82');
      expect(options).toEqual({ replyTo: 'john@example.com' });
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

  it.each([
    [null, ''],
    ['CredentialsSignin', 'Invalid email or password. Please try again.'],
    ['OAuthAccountNotLinked', 'This email is already registered with another sign-in method.'],
    ['AccessDenied', 'Sign-in was cancelled or denied.'],
    ['UnknownCode', 'Unable to sign in. Please try again.'],
  ])('authErrorMessage(%p) -> %p', (code, expected) => {
    expect(authErrorMessage(code)).toBe(expected);
  });
});

describe('Newsletter production default & duplicate handling', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    (db.customerProfile.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it('accepts on-site signups in production without Mailchimp keys', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    (getConfig as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: 'collector@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await newsletterPost(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.mode).toBe('site');
  });

  it('returns 409 for duplicate on-site subscriber', async () => {
    (db.customerProfile.findUnique as jest.Mock).mockResolvedValueOnce({
      email: 'existing@example.com',
      segments: JSON.stringify(['newsletter_subscriber']),
      preferences: JSON.stringify({ newsletter: true }),
    });

    const request = new NextRequest('http://localhost:3000/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: 'existing@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect((await newsletterPost(request)).status).toBe(409);
  });
});

describe('Analytics filtering & finite math', () => {
  beforeEach(() => {
    (db.analyticsEvent.create as jest.Mock).mockClear();
    (getServerSession as jest.Mock).mockResolvedValue(null);
  });

  it.each([
    ['https://studio.example/admin', true],
    ['https://studio.example/admin?tab=analytics', true],
    ['https://studio.example/api/events', true],
    ['https://studio.example/auth', true],
    ['https://studio.example/auth/signin', true],
    ['https://studio.example/auth/signup?callbackUrl=/admin', true],
    ['https://studio.example/?cmsPreview=1', true],
    ['https://studio.example/portfolio?preview=draft', true],
    ['https://studio.example/', false],
    ['https://studio.example/author', false],
    ['https://studio.example/portfolio', false],
    ['https://studio.example/shop/print-1', false],
  ])('shouldIgnoreAnalyticsPageUrl(%p) -> %p', (url, ignored) => {
    expect(shouldIgnoreAnalyticsPageUrl(url)).toBe(ignored);
  });

  it('ignores admin sessions, auth pages, and preview URLs on POST /api/events while recording visitor events', async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce({
      user: { id: 'admin-1', email: 'artist@artistsite.com', isAdmin: true },
    });
    const adminReq = new NextRequest('http://localhost:3000/api/events', {
      method: 'POST',
      body: JSON.stringify({ event_name: 'page_view', session_id: 's1', page_url: 'http://localhost:3000/' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const adminRes = await eventsPost(adminReq);
    expect(adminRes.status).toBe(202);
    expect((await adminRes.json()).ignored).toBe(true);
    expect(db.analyticsEvent.create).not.toHaveBeenCalled();

    const authReq = new NextRequest('http://localhost:3000/api/events', {
      method: 'POST',
      body: JSON.stringify({ event_name: 'page_view', session_id: 's-auth', page_url: 'http://localhost:3000/auth/signin' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const authRes = await eventsPost(authReq);
    expect(authRes.status).toBe(202);
    expect((await authRes.json()).ignored).toBe(true);
    expect(db.analyticsEvent.create).not.toHaveBeenCalled();

    const previewReq = new NextRequest('http://localhost:3000/api/events', {
      method: 'POST',
      body: JSON.stringify({ event_name: 'page_view', session_id: 's2', page_url: 'http://localhost:3000/?cmsPreview=1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const previewRes = await eventsPost(previewReq);
    expect(previewRes.status).toBe(202);
    expect(db.analyticsEvent.create).not.toHaveBeenCalled();

    const visitorReq = new NextRequest('http://localhost:3000/api/events', {
      method: 'POST',
      body: JSON.stringify({ event_name: 'page_view', session_id: 's3', page_url: 'http://localhost:3000/portfolio' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const visitorRes = await eventsPost(visitorReq);
    expect(visitorRes.status).toBe(201);
    expect(db.analyticsEvent.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    [[], 0, 0],
    [[100], 100, 100],
    [[100, 300], 200, 200],
    [[50, 100, 600], 250, 100],
  ])('calculateLifetimeValue(%p) -> avg=%p median=%p', async (values, expectedAvg, expectedMedian) => {
    (db.customerProfile.findMany as jest.Mock).mockResolvedValueOnce(
      values.map((lifetimeValue) => ({
        lifetimeValue,
        segments: '[]',
        createdAt: new Date('2026-11-01T00:00:00Z'),
      })),
    );
    const result = await CustomerInsights.calculateLifetimeValue();
    expect(result.averageLTV).toBe(expectedAvg);
    expect(result.medianLTV).toBe(expectedMedian);
    expect(Number.isFinite(result.averageLTV)).toBe(true);
    expect(Number.isFinite(result.medianLTV)).toBe(true);
  });

  it('returns 0 averageEngagement when there are no customer profiles', async () => {
    (db.customerProfile.findMany as jest.Mock).mockResolvedValueOnce([]);
    (db.analyticsEvent.findMany as jest.Mock).mockResolvedValueOnce([]);
    const result = await CustomerInsights.analyzeEngagementTrends();
    expect(result.averageEngagement).toBe(0);
    expect(Number.isFinite(result.averageEngagement)).toBe(true);
  });
});

describe('Monitoring & performance route hardening', () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
  });

  it.each([
    ['GET /api/monitoring/security', () => monitoringSecurityGet()],
    ['POST /api/monitoring/performance', () => monitoringPerformancePost()],
    ['GET /api/performance', () => performanceGet()],
  ])('rejects unauthenticated %s with 401', async (_label, invoke) => {
    const response = await invoke();
    expect(response.status).toBe(401);
  });

  it('returns null score/lastAudit when no security audit has been run', async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce({
      user: { id: 'admin-1', email: 'artist@artistsite.com', isAdmin: true },
    });
    const response = await monitoringSecurityGet();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.overallScore).toBeNull();
    expect(data.criticalIssues).toBeNull();
    expect(data.lastAudit).toBeNull();
  });
});
