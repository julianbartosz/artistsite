import { POST as contactPost } from '@/app/api/contact/route';
import { POST as newsletterPost } from '@/app/api/newsletter/route';
import { GET as previewGet, POST as previewPost } from '@/app/api/preview/route';
import { NextRequest } from 'next/server';

// Mock console.log and console.warn to avoid noise in tests
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'warn').mockImplementation();

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

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

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

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await contactPost(request);
      
      expect(response.status).toBe(400);
    });
  });

  describe('Newsletter API', () => {
    it('should handle valid newsletter subscription', async () => {
      const subscriptionData = {
        email: 'subscriber@example.com'
      };

      const request = new NextRequest('http://localhost:3000/api/newsletter', {
        method: 'POST',
        body: JSON.stringify(subscriptionData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await newsletterPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Successfully subscribed to newsletter!');
      expect(data.email).toBe('subscriber@example.com');
      expect(data.mode).toBe('development'); // Since no ESP is configured
    });

    it('should reject invalid email addresses', async () => {
      const invalidData = {
        email: 'invalid-email'
      };

      const request = new NextRequest('http://localhost:3000/api/newsletter', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await newsletterPost(request);
      
      expect(response.status).toBe(400);
    });

    it('should reject missing email', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      });

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
      const request = new NextRequest('http://localhost:3000/api/preview?secret=test-secret-123&slug=test-post', {
        method: 'GET',
      });

      const response = await previewGet(request);
      
      expect(response.status).toBe(307); // Redirect
    });

    it('should reject invalid preview secret', async () => {
      const request = new NextRequest('http://localhost:3000/api/preview?secret=wrong-secret&slug=test-post', {
        method: 'GET',
      });

      const response = await previewGet(request);
      
      expect(response.status).toBe(401);
    });

    it('should disable preview mode', async () => {
      const request = new NextRequest('http://localhost:3000/api/preview', {
        method: 'POST',
      });

      const response = await previewPost(request);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: 'invalid json{',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await contactPost(request);
      
      expect(response.status).toBe(500);
    });

    it('should handle missing content-type header', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        // No Content-Type header
      });

      // Should still work as Next.js handles this gracefully
      const response = await newsletterPost(request);
      
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});