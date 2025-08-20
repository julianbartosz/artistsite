// filepath: src/ui/components/analytics/AnalyticsChart.tsx
'use client';
import React from 'react';
import { IconChartBars } from '@ui/icons/actions';
interface AnalyticsChartProps {
  data?: any[];
  type?: 'line' | 'bar' | 'pie';
  title?: string;
  className?: string;
}
export default function AnalyticsChart({ 
  data = [], 
  type = 'line', 
  title = 'Analytics Chart',
  className = '' 
}: AnalyticsChartProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-gray-400 mb-2">
              <IconChartBars className="mx-auto h-12 w-12" />
            </div>
            <p>No data available</p>
          </div>
        </div>
      ) : (
        <div className="h-64">
          {/* Simple visualization placeholder - in a real app you'd use Chart.js, D3, or similar */}
          <div className="h-full flex items-end space-x-2 px-4">
            {data.slice(0, 10).map((item, index) => (
              <div
                key={index}
                className="bg-blue-500 rounded-t"
                style={{
                  height: `${Math.max(10, (item.value || Math.random()) * 100)}%`,
                  minWidth: '20px',
                  flex: 1
                }}
                title={`${item.label || `Item ${index + 1}`}: ${item.value || 'N/A'}`}
              />
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Chart Type: {type.charAt(0).toUpperCase() + type.slice(1)}</p>
        <p>Data Points: {data.length}</p>
      </div>
    </div>
  );
}
