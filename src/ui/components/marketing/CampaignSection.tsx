'use client'
import React from 'react'
export function CampaignSection({ title, icon, campaigns }: {
  title: string;
  icon: string;
  campaigns: Array<{ name: string; status: string; performance: string }>;
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center mb-4">
        <span className="text-xl mr-2">{icon}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">
        {campaigns.map((campaign, index) => (
          <div key={index} className="border-l-4 border-blue-500 pl-3">
            <div className="font-medium">{campaign.name}</div>
            <div className="text-sm text-gray-600">{campaign.performance}</div>
            <div className={`text-xs px-2 py-1 rounded inline-block mt-1 ${
              campaign.status === 'active' ? 'bg-green-100 text-green-800' :
              campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {campaign.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
