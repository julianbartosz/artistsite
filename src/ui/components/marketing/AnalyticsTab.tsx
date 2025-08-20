import { JourneyStep, AttributionBar, AnalyticsMetric } from './primitives'

export function AnalyticsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Customer Journey</h3>
          <div className="space-y-4">
            <JourneyStep step="Discovery" percentage={100} visitors="2,450" />
            <JourneyStep step="Interest" percentage={45} visitors="1,103" />
            <JourneyStep step="Consideration" percentage={32} visitors="785" />
            <JourneyStep step="Purchase" percentage={12} visitors="294" />
            <JourneyStep step="Retention" percentage={68} visitors="200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Revenue Attribution</h3>
          <div className="space-y-3">
            <AttributionBar channel="Email Marketing" percentage={35} revenue="$8,450" />
            <AttributionBar channel="Social Media" percentage={28} revenue="$6,780" />
            <AttributionBar channel="Paid Ads" percentage={22} revenue="$5,320" />
            <AttributionBar channel="Direct Traffic" percentage={15} revenue="$3,630" />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Advanced Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnalyticsMetric title="Customer Lifetime Value" value="$1,245" trend="+12.3%" description="Average CLV across all segments" />
          <AnalyticsMetric title="Acquisition Cost" value="$78" trend="-8.5%" description="Blended CAC across channels" />
          <AnalyticsMetric title="Retention Rate" value="68%" trend="+5.2%" description="12-month customer retention" />
          <AnalyticsMetric title="Engagement Score" value="76/100" trend="+14.1%" description="Average customer engagement" />
        </div>
      </div>
    </div>
  )
}
