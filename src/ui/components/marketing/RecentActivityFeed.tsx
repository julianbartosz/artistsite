'use client'
import React from 'react'
export function RecentActivityFeed() {
  const activities = [
    { time: '2 min ago', activity: 'Cart abandonment email sent to 23 users', type: 'email' },
    { time: '15 min ago', activity: 'New Instagram post published: "Spring Collection"', type: 'social' },
    { time: '1 hour ago', activity: 'Facebook ad campaign optimization completed', type: 'ads' },
    { time: '2 hours ago', activity: '15 new contacts synced to Salesforce', type: 'crm' },
    { time: '3 hours ago', activity: 'Welcome email sequence triggered for 8 new users', type: 'email' }
  ]
  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${
            activity.type === 'email' ? 'bg-blue-500' :
            activity.type === 'social' ? 'bg-purple-500' :
            activity.type === 'ads' ? 'bg-green-500' :
            'bg-orange-500'
          }`}></div>
          <div className="flex-1">
            <div className="text-sm">{activity.activity}</div>
            <div className="text-xs text-gray-500">{activity.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
