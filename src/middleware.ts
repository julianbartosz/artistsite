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
  // Storefront StockIndicator uses GET ?productId=; route handler still requireAdmin for bulk/dashboard.
  { prefix: '/api/inventory', methods: ['POST'] },
  // Checkout uses /api/checkout + Stripe webhooks; direct order creation is admin-only.
  { prefix: '/api/orders', methods: ['POST'] },
  { prefix: '/api/upload' },
  { prefix: '/api/analytics/customers' },
  { prefix: '/api/analytics/performance', methods: ['GET'] },
  { prefix: '/api/analytics/dashboard' },
  { prefix: '/api/analytics/events', methods: ['GET'] },
  { prefix: '/api/analytics/seo' },
  { prefix: '/api/errors', methods: ['GET'] },
  { prefix: '/api/performance', methods: ['GET'] },
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

/** Sends the www / apex twin of the canonical host to the canonical origin. */
function canonicalHostRedirect(request: NextRequest): NextResponse | null {
  let canonical: URL;
  try {
    canonical = new URL(process.env.NEXTAUTH_URL || '');
  } catch {
    return null;
  }

  const twinHost = canonical.host.startsWith('www.') ? canonical.host.slice('www.'.length) : `www.${canonical.host}`;
  if (request.headers.get('host')?.toLowerCase() !== twinHost) return null;

  return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonical.origin), 308);
}

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;

  const redirect = canonicalHostRedirect(request);
  if (redirect) return redirect;

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
        "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com https://checkout.stripe.com https://www.googletagmanager.com https://connect.facebook.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https: blob:; font-src 'self' data:; frame-src 'self' https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; frame-ancestors 'self'; connect-src 'self' https://api.stripe.com https://checkout.stripe.com https://*.mailchimp.com https://www.google-analytics.com https://region1.google-analytics.com https://graph.facebook.com https://www.facebook.com;"
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
