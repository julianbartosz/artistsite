'use client'
import React from 'react'
export function AnalyticsMetric({ title, value, trend, description }: {
  title: string;
  value: string;
  trend: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className={`text-xs ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
        {trend}
      </div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </div>
  )
}
