import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PROTECTED_API_PREFIXES = ['/api/admin', '/api/marketing'];
const DEV_AUTH_SECRET = 'artistsite-local-auth-secret';

function resolvedAuthSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV !== 'production' ? DEV_AUTH_SECRET : undefined);
}

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;

  const protectedApi = PROTECTED_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (protectedApi) {
    const token = await getToken({ req: request, secret: resolvedAuthSecret() });
    if (!token?.isAdmin) {
      return NextResponse.json(
        { error: token ? 'Admin access required' : 'Authentication required', code: token ? 'FORBIDDEN' : 'UNAUTHENTICATED' },
        { status: token ? 403 : 401 }
      );
    }
  }
  
  // Clone the response to capture metrics
  const response = NextResponse.next();

  // Track metrics after response (non-blocking)
  response.headers.set('x-request-start', startTime.toString());
  
  // Add security headers
  // SAMEORIGIN allows the admin Site Pages live-preview iframe while blocking third-party embeds.
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Add CSP header for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://connect.facebook.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com https://*.mailchimp.com https://www.google-analytics.com https://region1.google-analytics.com https://graph.facebook.com https://www.facebook.com;"
    );
  }
  
  // Log request metrics asynchronously
  if (!pathname.startsWith('/api/monitoring')) {
    logRequestMetrics();
  }
  
  return response;
}

async function logRequestMetrics() {
  // Request metrics are derived from durable analytics events elsewhere.
  // Avoid a write-amplifying self-fetch from middleware on every page load.
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