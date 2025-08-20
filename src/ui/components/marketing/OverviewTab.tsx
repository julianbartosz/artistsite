import { MetricCard } from './MetricCard'
import { RecentActivityFeed } from './primitives'
import type { MarketingOverview } from './types'

export function OverviewTab({ overview }: { overview: MarketingOverview | null }) {
  if (!overview) return <div>No data available</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`$${overview.totalRevenue.toLocaleString()}`}
          change="+15.3%"
          changeType="positive"
          icon="💰"
        />
        <MetricCard
          title="Marketing ROI"
          value={`${overview.roi.toFixed(1)}x`}
          change="+8.2%"
          changeType="positive"
          icon="📈"
        />
        <MetricCard
          title="Active Customers"
          value={overview.activeCustomers.toLocaleString()}
          change="+12.5%"
          changeType="positive"
          icon="👥"
        />
        <MetricCard
          title="Total Spend"
          value={`$${overview.totalCost.toLocaleString()}`}
          change="-3.1%"
          changeType="negative"
          icon="💳"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Channel Performance</h3>
          <div className="space-y-4">
            {overview.topPerformingChannels?.filter((c) => c && c.channel)?.map((channel, index) => (
              <div key={channel.channel} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className={`w-3 h-3 rounded-full mr-3 ${
                      index === 0
                        ? 'bg-green-500'
                        : index === 1
                        ? 'bg-blue-500'
                        : index === 2
                        ? 'bg-yellow-500'
                        : 'bg-gray-400'
                    }`}
                  ></div>
                  <span className="font-medium capitalize">{channel.channel}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">${(channel.revenue || 0).toLocaleString()}</div>
                  <div className="text-sm text-gray-500">
                    {channel.roi !== null && channel.roi !== undefined
                      ? isFinite(channel.roi)
                        ? channel.roi.toFixed(1)
                        : '∞'
                      : '0.0'}
                    x ROI
                  </div>
                </div>
              </div>
            )) || <div className="text-gray-500">No channel data available</div>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Campaign Activity</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>📧 Email Campaigns</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance?.email?.sent || 0} sent</div>
                <div className="text-sm text-gray-500">
                  {overview.campaignPerformance?.email?.sent > 0
                    ? (
                        (overview.campaignPerformance.email.opened /
                          overview.campaignPerformance.email.sent) * 100
                      ).toFixed(1)
                    : '0.0'}
                  % open rate
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span>📱 Social Media</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance?.social?.posts || 0} posts</div>
                <div className="text-sm text-gray-500">
                  {(overview.campaignPerformance?.social?.reach || 0).toLocaleString()} reach
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span>🎯 Paid Ads</span>
              <div className="text-right">
                <div className="font-semibold">{overview.campaignPerformance?.ads?.conversions || 0} conversions</div>
                <div className="text-sm text-gray-500">
                  {(overview.campaignPerformance?.ads?.roas || 0).toFixed(1)}x ROAS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Recent Marketing Activity</h3>
        <RecentActivityFeed />
      </div>
    </div>
  )
}
