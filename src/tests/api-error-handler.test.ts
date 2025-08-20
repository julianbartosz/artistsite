import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';

describe('API Error Handler', () => {
  let mockRequest: Request & { json: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = Object.assign(new Request('http://localhost:3000/api/test', { method: 'POST' }), {
      json: jest.fn().mockResolvedValue({})
    });
  });

  describe('ApiError', () => {
    it('should create error with correct properties', () => {
      const error = new ApiError(400, 'Test error', 'TEST_ERROR');
      
      expect(error.status).toBe(400);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('ApiError');
    });

    it('should default to no code when not provided', () => {
      const error = new ApiError(500, 'Test error');
      
      expect(error.status).toBe(500);
      expect(error.code).toBeUndefined();
    });
  });

  describe('withApiErrorHandler', () => {
    it('should handle successful requests', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );
      const wrappedHandler = withApiErrorHandler(mockHandler);

      const result = await wrappedHandler(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(result.status).toBe(200);
    });

    it('should handle ApiError correctly', async () => {
      const mockHandler = jest.fn().mockRejectedValue(
        new ApiError(400, 'Validation failed', 'VALIDATION_ERROR')
      );
      const wrappedHandler = withApiErrorHandler(mockHandler);

      const result = await wrappedHandler(mockRequest);
      const data = await result.json();

      expect(result.status).toBe(400);
      expect(data.message).toBe('Validation failed');
      expect(data.status).toBe(400);
      expect(data.timestamp).toBeDefined();
    });

    it('should handle generic errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue(
        new Error('Unexpected error')
      );
      const wrappedHandler = withApiErrorHandler(mockHandler);

      const result = await wrappedHandler(mockRequest);
      const data = await result.json();

      expect(result.status).toBe(500);
      expect(data.message).toBe('Unexpected error');
      expect(data.status).toBe(500);
      expect(data.timestamp).toBeDefined();
    });

    it('should handle unknown errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue('String error');
      const wrappedHandler = withApiErrorHandler(mockHandler);

      const result = await wrappedHandler(mockRequest);
      const data = await result.json();

      expect(result.status).toBe(500);
      expect(data.message).toBe('An unexpected error occurred');
      expect(data.status).toBe(500);
      expect(data.timestamp).toBeDefined();
    });

    it('should log errors in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      // Use Object.defineProperty to properly mock NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        configurable: true
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockHandler = jest.fn().mockRejectedValue(
        new Error('Test error')
      );
      const wrappedHandler = withApiErrorHandler(mockHandler);
      await wrappedHandler(mockRequest);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
      
      // Restore original NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        configurable: true
      });
    });
  });
});