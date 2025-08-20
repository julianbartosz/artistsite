'use client'
import React from 'react'
export function AttributionBar({ channel, percentage, revenue }: {
  channel: string;
  percentage: number;
  revenue: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{channel}</span>
        <span>{revenue}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  )
}
