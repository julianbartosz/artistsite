'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { orderStatusLabel, type OrderStatus } from '@/lib/order-status-shared';

const PROGRESS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const satisfies readonly OrderStatus[];
type ProgressStep = (typeof PROGRESS_STEPS)[number];

const STEP_LABELS: Record<ProgressStep, string> = {
  pending: 'Placed',
  confirmed: 'Confirmed',
  processing: 'Preparing',
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
  const circle = size === 'large' ? 'h-9 w-9 text-xs' : 'h-8 w-8 text-xs';
  const labelClass = size === 'large' ? 'mt-2.5 text-xs sm:text-sm' : 'mt-1 text-xs';

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
                  className={`flex items-center justify-center rounded-full font-medium transition-colors ${circle} ${
                    complete
                      ? 'bg-primary text-white'
                      : current
                        ? 'bg-primary text-white ring-4 ring-primary/15'
                        : 'border border-gray-300 bg-surface-muted/70 text-gray-500'
                  }`}
                >
                  {complete ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> : index + 1}
                </div>
                <span
                  className={`${labelClass} ${
                    current
                      ? 'font-semibold text-gray-900'
                      : complete
                        ? 'font-medium text-primary'
                        : 'text-gray-500'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {index < PROGRESS_STEPS.length - 1 && (
                <div
                  className={`mx-2 mb-6 h-0.5 flex-1 rounded-full transition-colors ${
                    complete ? 'bg-primary/70' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <ol className="space-y-2.5 md:hidden">
        {PROGRESS_STEPS.map((step, index) => {
          const complete = isStepComplete(step, status);
          const current = isStepCurrent(step, status);
          return (
            <li key={step} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  complete
                    ? 'bg-primary text-white'
                    : current
                      ? 'bg-primary text-white ring-4 ring-primary/15'
                      : 'border border-gray-300 bg-surface-muted/70 text-gray-500'
                }`}
              >
                {complete ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> : index + 1}
              </div>
              <span
                className={`text-sm ${
                  current
                    ? 'font-semibold text-gray-900'
                    : complete
                      ? 'font-medium text-primary'
                      : 'text-gray-500'
                }`}
              >
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
