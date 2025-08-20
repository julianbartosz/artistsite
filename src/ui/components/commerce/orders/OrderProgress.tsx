// filepath: src/ui/components/commerce/orders/OrderProgress.tsx
'use client';
import React from 'react';
import type { OrderStatus } from '@/lib/orders';
import { statusSteps, statusIcons } from './status';

function getStatusStepIndex(status: OrderStatus): number {
  return statusSteps.indexOf(status);
}

function isStepCompleted(stepStatus: OrderStatus, currentStatus: OrderStatus): boolean {
  const stepIndex = getStatusStepIndex(stepStatus);
  const currentIndex = getStatusStepIndex(currentStatus);
  return stepIndex <= currentIndex && currentStatus !== 'cancelled' && currentStatus !== 'refunded';
}

export default function OrderProgress({ status }: { status: OrderStatus }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Progress</h2>
      <div className="relative flex items-center justify-between">
        {statusSteps.map((step, index) => {
          const completed = isStepCompleted(step, status);
          const current = step === status;
          return (
            <div key={step} className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  completed || current ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {completed && !current ? '✓' : statusIcons[step]}
              </div>
              <span
                className={`mt-2 text-sm ${
                  completed || current ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}
              >
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </span>
              {index < statusSteps.length - 1 && (
                <div
                  className={`hidden md:block absolute w-full h-0.5 mt-5 ${
                    completed ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  style={{ left: '50%', right: '-50%' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
