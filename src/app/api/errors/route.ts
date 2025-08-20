interface ErrorReport {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  environment: string;
  version: string;
  metadata?: Record<string, any>;
}

const errorStore: ErrorReport[] = [];
const maxErrors = 1000; // Keep last 1000 errors in memory

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const errorReport: ErrorReport = {
      id: generateErrorId(),
      timestamp: new Date().toISOString(),
      level: body.level || 'error',
      message: body.message || 'Unknown error',
      stack: body.stack,
      url: body.url || req.url,
      userAgent: req.headers.get('user-agent') || undefined,
      userId: body.userId,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      metadata: body.metadata,
    };

    // Store error in memory (in production, this would go to a database)
    errorStore.push(errorReport);
    if (errorStore.length > maxErrors) {
      errorStore.shift(); // Remove oldest error
    }

    // Log to console for immediate visibility
    console.error('Error reported:', {
      id: errorReport.id,
      level: errorReport.level,
      message: errorReport.message,
      url: errorReport.url,
    });

    // Send to external monitoring service (optional)
    if (process.env.NODE_ENV === 'production') {
      await sendToMonitoringService(errorReport);
    }

    // Update health metrics
    fetch('/api/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'error',
        severity: errorReport.level === 'error' ? 'critical' : 'normal',
      }),
    }).catch(() => {}); // Don't fail if health endpoint is down

    return json({
      success: true,
      errorId: errorReport.id,
    });
  } catch (error) {
    console.error('Failed to process error report:', error);
    return json(
      { error: 'Failed to process error report' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level');
    const limit = parseInt(searchParams.get('limit') || '50');

    let filteredErrors = errorStore;

    if (level) {
      filteredErrors = errorStore.filter((error) => error.level === level);
    }

    // Return most recent errors first
    const recentErrors = filteredErrors.slice(-limit).reverse();

    const summary = {
      total: errorStore.length,
      errors: errorStore.filter((e) => e.level === 'error').length,
      warnings: errorStore.filter((e) => e.level === 'warning').length,
      lastHour: errorStore.filter((e) => {
        const errorTime = new Date(e.timestamp);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return errorTime > oneHourAgo;
      }).length,
    };

    return json({
      summary,
      errors: recentErrors,
    });
  } catch (error) {
    return json(
      { error: 'Failed to retrieve errors' },
      { status: 500 }
    );
  }
}

function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function sendToMonitoringService(error: ErrorReport): Promise<void> {
  // This would integrate with services like Sentry, LogRocket, etc.
  // For now, we'll just log it
  if (process.env.SENTRY_DSN) {
    // Example: Send to Sentry
    try {
      // await Sentry.captureException(error);
      console.log('Would send to Sentry:', error.id);
    } catch (err) {
      console.error('Failed to send to Sentry:', err);
    }
  }
}