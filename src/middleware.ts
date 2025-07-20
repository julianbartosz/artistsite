import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const startTime = Date.now();
  
  // Clone the response to capture metrics
  const response = NextResponse.next();
  
  // Track metrics after response (non-blocking)
  response.headers.set('x-request-start', startTime.toString());
  
  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Add CSP header for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com https://*.mailchimp.com;"
    );
  }
  
  // Log request metrics asynchronously
  if (!request.nextUrl.pathname.startsWith('/api/monitoring')) {
    logRequestMetrics(request, startTime);
  }
  
  return response;
}

async function logRequestMetrics(request: NextRequest, startTime: number) {
  try {
    const responseTime = Date.now() - startTime;
    
    // Don't log internal Next.js requests
    if (request.nextUrl.pathname.startsWith('/_next/')) {
      return;
    }
    
    // Send metrics to monitoring endpoint
    fetch(`${request.nextUrl.origin}/api/monitoring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'request',
        responseTime,
        status: 200, // We'll assume success here, errors are tracked separately
        path: request.nextUrl.pathname,
        method: request.method,
        userAgent: request.headers.get('user-agent'),
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Silently fail if monitoring endpoint is unavailable
    });
  } catch (error) {
    // Don't let monitoring affect the main request
    console.error('Failed to log request metrics:', error);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};