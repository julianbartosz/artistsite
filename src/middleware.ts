import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

type AdminApiRule = {
  prefix: string;
  /** When set, only these methods require admin. Otherwise all methods. */
  methods?: readonly string[];
};

/**
 * Defense-in-depth for admin/ops surfaces. Route handlers still call requireAdmin.
 * Public ingest stays open: analytics event POST, error report POST, monitoring health.
 */
const ADMIN_API_RULES: readonly AdminApiRule[] = [
  { prefix: '/api/admin' },
  { prefix: '/api/marketing' },
  { prefix: '/api/security' },
  { prefix: '/api/inventory' },
  { prefix: '/api/upload' },
  { prefix: '/api/analytics/customers' },
  { prefix: '/api/analytics/performance', methods: ['GET'] },
  { prefix: '/api/analytics/dashboard' },
  { prefix: '/api/analytics/events', methods: ['GET'] },
  { prefix: '/api/errors', methods: ['GET'] },
  { prefix: '/api/monitoring/security' },
  { prefix: '/api/monitoring/performance' },
  { prefix: '/api/monitoring', methods: ['GET'] },
];

const DEV_AUTH_SECRET = 'artistsite-local-auth-secret';

function resolvedAuthSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV !== 'production' ? DEV_AUTH_SECRET : undefined);
}

function requiresAdminApi(pathname: string, method: string): boolean {
  if (pathname === '/api/monitoring/health' || pathname.startsWith('/api/monitoring/health/')) {
    return false;
  }

  for (const rule of ADMIN_API_RULES) {
    const matched = pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);
    if (!matched) continue;
    if (!rule.methods) return true;
    return rule.methods.includes(method.toUpperCase());
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;

  if (requiresAdminApi(pathname, request.method)) {
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
