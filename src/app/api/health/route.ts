interface SystemMetrics {
  timestamp: string;
  environment: string;
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  performance: {
    responseTime: number;
    requestCount: number;
  };
  services: {
    database: string;
    stripe: string;
    mailchimp: string;
    external: string[];
  };
  errors: {
    last24h: number;
    criticalErrors: number;
  };
}

let requestCount = 0;
let errorCount24h = 0;
let criticalErrors = 0;

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function GET(req: Request) {
  const startTime = Date.now();
  requestCount++;

  try {
    // Test external service connectivity
    const externalServices: string[] = [];
    
    // Test Stripe connectivity (non-blocking)
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const response = await fetch('https://api.stripe.com/v1/account', {
          headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
          signal: AbortSignal.timeout(3000)
        });
        externalServices.push(response.ok ? 'stripe:healthy' : 'stripe:degraded');
      } catch {
        externalServices.push('stripe:unreachable');
      }
    }

    // Test Mailchimp connectivity (non-blocking)
    if (process.env.MAILCHIMP_API_KEY) {
      try {
        const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX || 'us15';
        const response = await fetch(`https://${serverPrefix}.api.mailchimp.com/3.0/ping`, {
          headers: { Authorization: `Bearer ${process.env.MAILCHIMP_API_KEY}` },
          signal: AbortSignal.timeout(3000)
        });
        externalServices.push(response.ok ? 'mailchimp:healthy' : 'mailchimp:degraded');
      } catch {
        externalServices.push('mailchimp:unreachable');
      }
    }

    const responseTime = Date.now() - startTime;
    const memUsage = process.memoryUsage();

    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      performance: {
        responseTime,
        requestCount,
      },
      services: {
        database: 'not_configured',
        stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
        mailchimp: process.env.MAILCHIMP_API_KEY ? 'configured' : 'not_configured',
        external: externalServices,
      },
      errors: {
        last24h: errorCount24h,
        criticalErrors,
      },
    };

    // Determine overall health status
    const isHealthy = 
      metrics.memory.percentage < 90 &&
      metrics.performance.responseTime < 2000 &&
      !externalServices.some(service => service.includes('unreachable'));

    return json({
      status: isHealthy ? 'healthy' : 'degraded',
      ...metrics,
    }, { 
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    criticalErrors++;
    
    return json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      uptime: process.uptime(),
    }, { status: 503 });
  }
}

// Metrics endpoint for monitoring systems
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    if (body.type === 'error') {
      errorCount24h++;
      if (body.severity === 'critical') {
        criticalErrors++;
      }
    }

    return json({ received: true });
  } catch (error) {
    return json({ error: 'Invalid request' }, { status: 400 });
  }
}