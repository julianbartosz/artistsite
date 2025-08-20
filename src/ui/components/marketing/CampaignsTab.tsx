import { CampaignSection } from './CampaignSection'

export function CampaignsTab() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Active Campaigns</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Create Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CampaignSection
          title="Email Marketing"
          icon="📧"
          campaigns={[
            { name: 'Welcome Series', status: 'active', performance: '24% open rate' },
            { name: 'Cart Abandonment', status: 'active', performance: '18% recovery rate' },
            { name: 'VIP Collection Launch', status: 'scheduled', performance: 'Scheduled for tomorrow' }
          ]}
        />

        <CampaignSection
          title="Social Media"
          icon="📱"
          campaigns={[
            { name: 'Product Showcase', status: 'active', performance: '4.2% engagement' },
            { name: 'Behind the Scenes', status: 'active', performance: '6.8% engagement' },
            { name: 'Customer Testimonials', status: 'paused', performance: '3.1% engagement' }
          ]}
        />

        <CampaignSection
          title="Paid Advertising"
          icon="🎯"
          campaigns={[
            { name: 'Spring Collection FB Ads', status: 'active', performance: '3.2x ROAS' },
            { name: 'Retargeting Campaign', status: 'active', performance: '5.1x ROAS' },
            { name: 'Google Search Ads', status: 'active', performance: '2.8x ROAS' }
          ]}
        />
      </div>
    </div>
  )
}
