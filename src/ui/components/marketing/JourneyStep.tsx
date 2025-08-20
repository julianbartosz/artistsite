'use client'
import React from 'react'
export function JourneyStep({ step, percentage, visitors }: {
  step: string;
  percentage: number;
  visitors: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{step}</span>
        <span>{visitors} visitors</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  )
}
