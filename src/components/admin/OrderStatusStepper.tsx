'use client';

import React from 'react';
import { orderStatusLabel, type OrderStatus } from '@/lib/order-status-shared';

const PROGRESS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const satisfies readonly OrderStatus[];
type ProgressStep = (typeof PROGRESS_STEPS)[number];

const STEP_LABELS: Record<ProgressStep, string> = {
  pending: 'Placed',
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
  return stepIdx < currentIndex;
}

function isStepCurrent(step: ProgressStep, current: OrderStatus): boolean {
  return step === current;
}

type OrderStatusStepperProps = {
  status: OrderStatus;
};

function StepperVisual({ status, size = 'compact' }: { status: OrderStatus; size?: 'compact' | 'large' }) {
  const circle = size === 'large' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs';
  const labelClass = size === 'large' ? 'mt-2 text-sm' : 'mt-1 text-xs';

  return (
    <>
      <div className="hidden items-center md:flex">
        {PROGRESS_STEPS.map((step, index) => {
          const complete = isStepComplete(step, status);
          const current = isStepCurrent(step, status);
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center rounded-full font-medium ${circle} ${
                    complete || current ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {complete ? '✓' : index + 1}
                </div>
                <span className={`${labelClass} ${complete || current ? 'font-medium text-primary' : 'text-gray-500'}`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              {index < PROGRESS_STEPS.length - 1 && (
                <div
                  className={`mx-1 mb-5 h-0.5 flex-1 ${
                    isStepComplete(PROGRESS_STEPS[index + 1], status) || complete || current
                      ? 'bg-primary'
                      : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <ol className="space-y-2 md:hidden">
        {PROGRESS_STEPS.map((step) => {
          const complete = isStepComplete(step, status);
          const current = isStepCurrent(step, status);
          return (
            <li key={step} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  complete || current ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {complete ? '✓' : STEP_LABELS[step].charAt(0)}
              </div>
              <span className={`text-sm ${complete || current ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                {STEP_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export default function OrderStatusStepper({ status }: OrderStatusStepperProps) {
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <p className="text-sm text-gray-600">
        Order {orderStatusLabel(status)}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <StepperVisual status={status} size="compact" />
    </div>
  );
}

export function OrderProgressSteps({ status }: OrderStatusStepperProps) {
  if (status === 'cancelled' || status === 'refunded') return null;

  return (
    <div className="space-y-3">
      <StepperVisual status={status} size="large" />
    </div>
  );
}
