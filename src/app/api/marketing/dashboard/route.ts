import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Type assertion to access marketing models until TypeScript recognizes them
const dbWithMarketing = db as any;

export async function POST(request: NextRequest) {
  try {
    const { dateRange, channels } = await request.json();
    
    // Calculate date filter
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Aggregate data from all marketing channels
    const overview = {
      totalRevenue: await getTotalRevenue(startDate),
      totalCost: await getTotalCost(startDate, channels),
      roi: 0, // Will be calculated below
      activeCustomers: await getActiveCustomers(startDate),
      campaignPerformance: await getCampaignPerformance(startDate, channels),
      topPerformingChannels: await getTopPerformingChannels(startDate, channels)
    };

    // Calculate ROI
    overview.roi = overview.totalCost > 0 ? overview.totalRevenue / overview.totalCost : 0;

    return NextResponse.json(overview);
  } catch (error) {
    console.error('Error generating marketing dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}

async function getTotalRevenue(startDate: Date): Promise<number> {
  // Get revenue from orders within date range
  const orders = await db.order.findMany({
    where: {
      createdAt: { gte: startDate },
      status: 'completed'
    }
  });
  
  return orders.reduce((sum, order) => sum + order.total, 0);
}

async function getTotalCost(startDate: Date, channels: string[]): Promise<number> {
  let totalCost = 0;

  // Email marketing costs
  if (channels.includes('email')) {
    const emailEvents = await db.analyticsEvent.findMany({
      where: {
        eventName: 'email_sent',
        timestamp: { gte: startDate }
      }
    });
    totalCost += emailEvents.length * 0.01; // $0.01 per email
  }

  // Social media costs (organic - time cost estimate)
  if (channels.includes('social')) {
    const socialPosts = await dbWithMarketing.socialMediaPost.findMany({
      where: {
        publishedAt: { gte: startDate }
      }
    });
    totalCost += socialPosts.length * 25; // $25 per post (time cost)
  }

  // Paid advertising costs
  if (channels.includes('ads')) {
    const adCampaigns = await dbWithMarketing.adCampaign.findMany({
      where: {
        startDate: { gte: startDate }
      }
    });
    
    totalCost += adCampaigns.reduce((sum: number, campaign: any) => {
      try {
        const performance = JSON.parse(campaign.performance || '{}');
        return sum + (performance.cost || 0);
      } catch {
        return sum;
      }
    }, 0);
  }

  // Get actual budget data
  const budgets = await dbWithMarketing.marketingBudget.findMany({
    where: {
      channel: { in: channels },
      periodStart: { lte: new Date() },
      periodEnd: { gte: startDate }
    }
  });

  totalCost += budgets.reduce((sum: number, budget: any) => sum + budget.spentBudget, 0);

  return totalCost;
}

async function getActiveCustomers(startDate: Date): Promise<number> {
  return await db.user.count({
    where: {
      OR: [
        { orders: { some: { createdAt: { gte: startDate } } } },
        { createdAt: { gte: startDate } }
      ]
    }
  });
}

async function getCampaignPerformance(startDate: Date, channels: string[]) {
  const performance = {
    email: { sent: 0, opened: 0, clicked: 0, converted: 0 },
    social: { posts: 0, engagement: 0, reach: 0, clicks: 0 },
    ads: { impressions: 0, clicks: 0, conversions: 0, roas: 0 }
  };

  // Email performance
  if (channels.includes('email')) {
    const emailEvents = await db.analyticsEvent.findMany({
      where: {
        eventName: { in: ['email_sent', 'email_opened', 'email_clicked', 'email_converted'] },
        timestamp: { gte: startDate }
      }
    });

    performance.email.sent = emailEvents.filter(e => e.eventName === 'email_sent').length;
    performance.email.opened = emailEvents.filter(e => e.eventName === 'email_opened').length;
    performance.email.clicked = emailEvents.filter(e => e.eventName === 'email_clicked').length;
    performance.email.converted = emailEvents.filter(e => e.eventName === 'email_converted').length;
  }

  // Social media performance
  if (channels.includes('social')) {
    const socialPosts = await dbWithMarketing.socialMediaPost.findMany({
      where: {
        publishedAt: { gte: startDate }
      }
    });

    performance.social.posts = socialPosts.length;
    performance.social.engagement = socialPosts.reduce((sum: number, post: any) => {
      try {
        const engagement = JSON.parse(post.engagement || '{}');
        return sum + (engagement.likes + engagement.comments + engagement.shares || 0);
      } catch {
        return sum;
      }
    }, 0);
    performance.social.reach = socialPosts.reduce((sum: number, post: any) => {
      try {
        const engagement = JSON.parse(post.engagement || '{}');
        return sum + (engagement.reach || 0);
      } catch {
        return sum;
      }
    }, 0);
    performance.social.clicks = socialPosts.reduce((sum: number, post: any) => {
      try {
        const engagement = JSON.parse(post.engagement || '{}');
        return sum + (engagement.clicks || 0);
      } catch {
        return sum;
      }
    }, 0);
  }

  // Ads performance
  if (channels.includes('ads')) {
    const adCampaigns = await dbWithMarketing.adCampaign.findMany({
      where: {
        startDate: { gte: startDate }
      }
    });

    performance.ads = adCampaigns.reduce((acc: any, campaign: any) => {
      try {
        const perf = JSON.parse(campaign.performance || '{}');
        return {
          impressions: acc.impressions + (perf.impressions || 0),
          clicks: acc.clicks + (perf.clicks || 0),
          conversions: acc.conversions + (perf.conversions || 0),
          roas: acc.roas + (perf.roas || 0)
        };
      } catch {
        return acc;
      }
    }, { impressions: 0, clicks: 0, conversions: 0, roas: 0 });

    if (adCampaigns.length > 0) {
      performance.ads.roas = performance.ads.roas / adCampaigns.length; // Average ROAS
    }
  }

  return performance;
}

async function getTopPerformingChannels(startDate: Date, channels: string[]) {
  const channelPerformance = [];

  // Get marketing attribution data for accurate channel performance
  const attributions = await dbWithMarketing.marketingAttribution.findMany({
    where: {
      createdAt: { gte: startDate }
    }
  });

  // Group attributions by channel
  const channelRevenue = attributions.reduce((acc: Record<string, number>, attr: any) => {
    try {
      const attribution = JSON.parse(attr.attribution || '{}');
      Object.entries(attribution).forEach(([channel, weight]) => {
        if (channels.includes(channel)) {
          acc[channel] = (acc[channel] || 0) + (attr.attributedRevenue * (weight as number));
        }
      });
    } catch {
      // If attribution parsing fails, use primary channel
      if (channels.includes(attr.primaryChannel)) {
        acc[attr.primaryChannel] = (acc[attr.primaryChannel] || 0) + attr.attributedRevenue;
      }
    }
    return acc;
  }, {});

  // Calculate performance for each requested channel
  for (const channel of channels) {
    const revenue = channelRevenue[channel] || 0;
    const cost = await getChannelCost(channel, startDate);
    const conversions = await getChannelConversions(channel, startDate);

    channelPerformance.push({
      channel,
      revenue,
      cost,
      roi: cost > 0 ? revenue / cost : 0,
      conversions
    });
  }

  // Add direct/organic channel
  const directRevenue = channelRevenue['direct'] || (await getTotalRevenue(startDate)) * 0.15;
  channelPerformance.push({
    channel: 'direct',
    revenue: directRevenue,
    cost: 0,
    roi: Infinity,
    conversions: await getChannelConversions('direct', startDate)
  });

  // Sort by ROI
  return channelPerformance.sort((a, b) => b.roi - a.roi);
}

async function getChannelCost(channel: string, startDate: Date): Promise<number> {
  // Get actual budget data for the channel
  const budgets = await dbWithMarketing.marketingBudget.findMany({
    where: {
      channel: channel,
      periodStart: { lte: new Date() },
      periodEnd: { gte: startDate }
    }
  });

  let channelCost = budgets.reduce((sum: number, budget: any) => sum + budget.spentBudget, 0);

  // Add specific channel costs if no budget data
  if (channelCost === 0) {
    switch (channel) {
      case 'email':
        const emailEvents = await db.analyticsEvent.count({
          where: {
            eventName: 'email_sent',
            timestamp: { gte: startDate }
          }
        });
        channelCost = emailEvents * 0.01;
        break;
      case 'social':
        const socialPosts = await dbWithMarketing.socialMediaPost.count({
          where: {
            publishedAt: { gte: startDate }
          }
        });
        channelCost = socialPosts * 25;
        break;
      case 'ads':
        const adCampaigns = await dbWithMarketing.adCampaign.findMany({
          where: {
            startDate: { gte: startDate }
          }
        });
        channelCost = adCampaigns.reduce((sum: number, campaign: any) => {
          try {
            const performance = JSON.parse(campaign.performance || '{}');
            return sum + (performance.cost || 0);
          } catch {
            return sum;
          }
        }, 0);
        break;
    }
  }

  return channelCost;
}

async function getChannelConversions(channel: string, startDate: Date): Promise<number> {
  // Count conversions attributed to each channel
  const attributions = await dbWithMarketing.marketingAttribution.findMany({
    where: {
      primaryChannel: channel,
      createdAt: { gte: startDate }
    }
  });

  return attributions.length;
}