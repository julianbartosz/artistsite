interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  url: string;
  timestamp: number;
}

// Lightweight json helper
function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

export async function POST(request: Request) {
  try {
    const metrics: WebVitalsMetric[] = await request.json();
    
    // In production, you would send this to your analytics service
    // For now, we'll log and store in memory/database
    console.log('Web Vitals metrics received:', metrics);
    
    // You could implement analytics here:
    // - Send to Google Analytics 4
    // - Store in database for reporting
    // - Send to monitoring service like DataDog or New Relic
    
    // Example: Send to Google Analytics 4
    if (process.env.GA_MEASUREMENT_ID) {
      for (const metric of metrics) {
        await sendToGA4(metric);
      }
    }
    
    return json({ success: true, received: metrics.length });
  } catch (error) {
    console.error('Error processing performance metrics:', error);
    return json(
      { error: 'Failed to process metrics' },
      { status: 500 }
    );
  }
}

async function sendToGA4(metric: WebVitalsMetric) {
  const measurementId = process.env.GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;
  
  if (!measurementId || !apiSecret) {
    return;
  }
  
  try {
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: metric.id,
        events: [{
          name: 'web_vital',
          params: {
            metric_name: metric.name,
            metric_value: metric.value,
            metric_rating: metric.rating,
            page_location: metric.url,
          }
        }]
      }),
    });
  } catch (error) {
    console.error('Failed to send metric to GA4:', error);
  }
}

// GET endpoint for retrieving performance data
export async function GET() {
  // This could return aggregated performance data
  // For demo purposes, return sample data
  const sampleData = {
    averageMetrics: {
      lcp: 2400,
      fid: 95,
      cls: 0.08,
      fcp: 1600,
      ttfb: 750,
    },
    pageViews: 1250,
    issues: [
      { type: 'LCP', count: 12, description: 'Images without optimization' },
      { type: 'CLS', count: 8, description: 'Layout shifts on mobile' },
    ],
    lastUpdated: new Date().toISOString(),
  };
  
  return json(sampleData);
}