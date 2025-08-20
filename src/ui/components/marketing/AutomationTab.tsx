import { useState } from 'react'
import { AutomationRule } from './AutomationRule'

export function AutomationTab() {
  const [automations] = useState({
    email: { active: 0, total: 0 },
    social: { active: 0, total: 0 },
    crm: { active: 0, total: 0 }
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📧 Email Automation</h3>
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              {automations.email.active} Active
            </span>
          </div>
          <div className="space-y-3">
            <AutomationRule name="Welcome Series" trigger="New user signup" status="active" performance="24% open rate" />
            <AutomationRule name="Cart Abandonment" trigger="Cart inactive 1 hour" status="active" performance="18% recovery" />
            <AutomationRule name="Post-Purchase Follow-up" trigger="Order completed" status="active" performance="31% satisfaction" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📱 Social Automation</h3>
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              {automations.social.active} Active
            </span>
          </div>
          <div className="space-y-3">
            <AutomationRule name="Product Showcase" trigger="New product added" status="active" performance="Auto-posted to 3 platforms" />
            <AutomationRule name="Customer Reviews" trigger="5-star review received" status="active" performance="Auto-shared testimonials" />
            <AutomationRule name="Weekly Schedule" trigger="Every Monday/Wednesday/Friday" status="active" performance="Consistent posting" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">👥 CRM Automation</h3>
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              {automations.crm.active} Active
            </span>
          </div>
          <div className="space-y-3">
            <AutomationRule name="Lead Scoring" trigger="User behavior changes" status="active" performance="Auto-updates lead scores" />
            <AutomationRule name="Salesforce Sync" trigger="New customer data" status="active" performance="Real-time sync" />
            <AutomationRule name="Salesforce Integration" trigger="High-value purchase" status="active" performance="Auto-creates opportunities" />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Automation Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">94%</div>
            <div className="text-sm text-gray-500">Automation Success Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">2.3hrs</div>
            <div className="text-sm text-gray-500">Time Saved Daily</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">$4,230</div>
            <div className="text-sm text-gray-500">Revenue from Automation</div>
          </div>
        </div>
      </div>
    </div>
  )
}
