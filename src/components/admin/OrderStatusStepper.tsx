'use client';

import React from 'react';
import type { OrderStatus } from '@/lib/orders';

const PROGRESS_STEPS = ['confirmed', 'processing', 'shipped', 'delivered'] as const satisfies readonly OrderStatus[];
type ProgressStep = (typeof PROGRESS_STEPS)[number];

const STEP_LABELS: Record<ProgressStep, string> = {
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

function stepIndex(status: OrderStatus): number {
  return (PROGRESS_STEPS as readonly OrderStatus[]).indexOf(status);
}

function isStepComplete(step: ProgressStep, current: OrderStatus): boolean {
  if (current === 'cancelled' || current === 'refunded') return false;
  const currentIndex = stepIndex(current);
  const stepIdx = stepIndex(step);
  if (currentIndex < 0 || stepIdx < 0) return false;
  return stepIdx <= currentIndex;
}

type OrderStatusStepperProps = {
  status: OrderStatus;
};

export default function OrderStatusStepper({ status }: OrderStatusStepperProps) {
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <p className="text-sm capitalize text-gray-600">
        Order {status}
      </p>
    );
  }

  const currentIndex = stepIndex(status);

  return (
    <div className="space-y-3">
      <div className="hidden items-center md:flex">
        {PROGRESS_STEPS.map((step, index) => {
          const complete = isStepComplete(step, status);
          const current = step === status || (currentIndex < 0 && index === 0);
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                    complete || current ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {complete && !current ? '✓' : index + 1}
                </div>
                <span className={`mt-1 text-xs ${complete || current ? 'font-medium text-primary' : 'text-gray-500'}`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              {index < PROGRESS_STEPS.length - 1 && (
                <div className={`mx-1 mb-5 h-0.5 flex-1 ${isStepComplete(PROGRESS_STEPS[index + 1], status) || complete ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <ol className="space-y-2 md:hidden">
        {PROGRESS_STEPS.map((step) => {
          const complete = isStepComplete(step, status);
          const current = step === status;
          return (
            <li key={step} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  complete || current ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {complete && !current ? '✓' : STEP_LABELS[step].charAt(0)}
              </div>
              <span className={`text-sm ${complete || current ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                {STEP_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function OrderProgressSteps({ status }: OrderStatusStepperProps) {
  if (status === 'cancelled' || status === 'refunded') return null;

  const currentIndex = stepIndex(status);

  return (
    <div className="space-y-3">
      <div className="hidden items-center md:flex">
        {PROGRESS_STEPS.map((step, index) => {
          const complete = isStepComplete(step, status);
          const current = step === status || (currentIndex < 0 && index === 0);
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                    complete || current ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {complete && !current ? '✓' : index + 1}
                </div>
                <span className={`mt-2 text-sm ${complete || current ? 'font-medium text-primary' : 'text-gray-500'}`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              {index < PROGRESS_STEPS.length - 1 && (
                <div
                  className={`mx-2 mb-6 h-0.5 flex-1 min-w-[1rem] ${
                    isStepComplete(PROGRESS_STEPS[index + 1], status) || complete ? 'bg-primary' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <ol className="space-y-3 md:hidden">
        {PROGRESS_STEPS.map((step) => {
          const complete = isStepComplete(step, status);
          const current = step === status;
          return (
            <li key={step} className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  complete || current ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {complete && !current ? '✓' : STEP_LABELS[step].charAt(0)}
              </div>
              <span className={`text-sm ${complete || current ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                {STEP_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
