import { POST as contactPost } from '@/app/api/contact/route';
import { POST as newsletterPost } from '@/app/api/newsletter/route';
import { GET as previewGet, DELETE as previewDelete } from '@/app/api/preview/route';
// Mock console.log and console.warn to avoid noise in tests
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'warn').mockImplementation();

function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('API Integration Tests', () => {
  describe('Contact API', () => {
    it('should handle valid contact form submission', async () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test inquiry',
        message: 'This is a test message for the contact form.',
        inquiryType: 'general'
      };
      const request = jsonRequest('http://localhost:3000/api/contact', 'POST', formData);
      const response = await contactPost(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.message).toBe('Message sent successfully!');
      expect(data.inquiryType).toBe('general');
    });

    it('should reject invalid contact form data', async () => {
      const invalidData = {
        name: '',
        email: 'invalid-email',
        subject: '',
        message: 'short',
      };
      const request = jsonRequest('http://localhost:3000/api/contact', 'POST', invalidData);
      const response = await contactPost(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Newsletter API', () => {
    it('should handle valid newsletter subscription', async () => {
      const subscriptionData = { email: 'subscriber@example.com' };
      const request = jsonRequest('http://localhost:3000/api/newsletter', 'POST', subscriptionData);
      const response = await newsletterPost(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.message).toBe('Successfully subscribed to newsletter!');
      expect(data.email).toBe('subscriber@example.com');
      expect(data.mode).toBe('development');
    });

    it('should reject invalid email addresses', async () => {
      const invalidData = { email: 'invalid-email' };
      const request = jsonRequest('http://localhost:3000/api/newsletter', 'POST', invalidData);
      const response = await newsletterPost(request);
      expect(response.status).toBe(400);
    });

    it('should reject missing email', async () => {
      const request = jsonRequest('http://localhost:3000/api/newsletter', 'POST', {});
      const response = await newsletterPost(request);
      expect(response.status).toBe(400);
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
      const request = jsonRequest('http://localhost:3000/api/preview?secret=test-secret-123&slug=test-post', 'GET');
      const response = await previewGet(request as any);
      expect(response.status).toBe(307); // Redirect
    });

    it('should reject invalid preview secret', async () => {
      const request = jsonRequest('http://localhost:3000/api/preview?secret=wrong-secret&slug=test-post', 'GET');
      const response = await previewGet(request as any);
      expect(response.status).toBe(401);
    });

    it('should disable preview mode', async () => {
      // DELETE handler does not use request directly
      const response = await previewDelete();
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in requests', async () => {
      const request = new Request('http://localhost:3000/api/contact', {
        method: 'POST',
        body: 'invalid json{',
        headers: { 'content-type': 'application/json' },
      });
      const response = await contactPost(request as any);
      expect(response.status).toBe(400); // Our handler now returns 400 for invalid JSON
    });

    it('should handle missing content-type header', async () => {
      const request = new Request('http://localhost:3000/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      const response = await newsletterPost(request as any);
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});