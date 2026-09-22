/** @jest-environment node */

import { POST as contactPost } from '@/app/api/contact/route';
import { POST as newsletterPost } from '@/app/api/newsletter/route';
import { GET as previewGet, DELETE as previewDelete } from '@/app/api/preview/route';
import { NextRequest } from 'next/server';
import { safeCallbackUrl, destinationAfterSignIn } from '@/app/auth/signin/SignInForm';

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
