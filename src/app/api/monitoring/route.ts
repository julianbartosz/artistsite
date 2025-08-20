interface DeploymentMetrics {
  environment: string;
  version: string;
  deployedAt: string;
  buildInfo: {
    commitSha: string;
    branch: string;
    buildTime: string;
  };
  performance: {
    averageResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
  };
  infrastructure: {
    containerStatus: string;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

// In-memory metrics storage (in production, use Redis or database)
const metricsStore = {
  requests: [] as Array<{ timestamp: number; responseTime: number; status: number }>,
  errors: [] as Array<{ timestamp: number; error: string; severity: string }>,
  alerts: [] as Array<{ level: 'info' | 'warning' | 'error' | 'critical'; message: string; timestamp: string }>,
};

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function GET(_req: Request) {
  try {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentRequests = metricsStore.requests.filter(r => r.timestamp > oneHourAgo);
    const recentErrors = metricsStore.errors.filter(e => e.timestamp > oneHourAgo);
    const averageResponseTime = recentRequests.length
      ? recentRequests.reduce((s, r) => s + r.responseTime, 0) / recentRequests.length
      : 0;
    const requestsPerMinute = recentRequests.length / 60;
    const errorRate = recentRequests.length
      ? (recentErrors.length / recentRequests.length) * 100
      : 0;
    const memUsage = process.memoryUsage();
    const metrics: DeploymentMetrics = {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      deployedAt: process.env.DEPLOYMENT_TIME || new Date().toISOString(),
      buildInfo: {
        commitSha: process.env.GITHUB_SHA || 'unknown',
        branch: process.env.GITHUB_REF_NAME || 'unknown',
        buildTime: process.env.BUILD_TIME || 'unknown',
      },
      performance: {
        averageResponseTime: Math.round(averageResponseTime),
        requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
      },
      infrastructure: {
        containerStatus: 'running',
        memoryUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        cpuUsage: Math.round(process.cpuUsage().system / 1000000),
        diskUsage: 0,
      },
      alerts: metricsStore.alerts.slice(-10),
    };
    if (metrics.performance.errorRate > 5)
      metricsStore.alerts.push({
        level: 'warning',
        message: `High error rate detected: ${metrics.performance.errorRate}%`,
        timestamp: new Date().toISOString(),
      });
    if (metrics.infrastructure.memoryUsage > 85)
      metricsStore.alerts.push({
        level: 'critical',
        message: `High memory usage: ${metrics.infrastructure.memoryUsage}%`,
        timestamp: new Date().toISOString(),
      });
    return json(metrics);
  } catch (error) {
    console.error('Monitoring endpoint error:', error);
    return json({ error: 'Failed to retrieve monitoring data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const timestamp = Date.now();
    if (body.type === 'request')
      metricsStore.requests.push({
        timestamp,
        responseTime: body.responseTime || 0,
        status: body.status || 200,
      });
    if (body.type === 'error')
      metricsStore.errors.push({
        timestamp,
        error: body.message || 'Unknown error',
        severity: body.severity || 'error',
      });
    const twentyFourHoursAgo = timestamp - 24 * 60 * 60 * 1000;
    metricsStore.requests = metricsStore.requests.filter(r => r.timestamp > twentyFourHoursAgo);
    metricsStore.errors = metricsStore.errors.filter(e => e.timestamp > twentyFourHoursAgo);
    metricsStore.alerts = metricsStore.alerts.filter(
      a => new Date(a.timestamp).getTime() > twentyFourHoursAgo
    );
    return json({ received: true });
  } catch {
    return json({ error: 'Invalid monitoring data' }, { status: 400 });
  }
}