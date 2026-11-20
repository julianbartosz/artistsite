'use client';

import React, { useMemo, useState } from 'react';
import type { PortfolioPageContent } from '@/lib/site-content-shared';
import {
  PORTFOLIO_PRESENTATION_PRESETS,
  applyPortfolioPresentationPreset,
  detectPortfolioPresentationPreset,
  type PortfolioPresentationPresetId,
} from '@/lib/portfolio-presentation';

type PortfolioPresentationWizardProps = {
  portfolio: PortfolioPageContent;
  onApply: (nextPortfolio: PortfolioPageContent) => void;
};

export default function PortfolioPresentationWizard({
  portfolio,
  onApply,
}: PortfolioPresentationWizardProps) {
  const current = useMemo(() => detectPortfolioPresentationPreset(portfolio), [portfolio]);
  const [selected, setSelected] = useState<PortfolioPresentationPresetId>(current ?? 'gallery-grid');
  const [expanded, setExpanded] = useState(!current);

  function applySelection() {
    onApply(applyPortfolioPresentationPreset(portfolio, selected));
    setExpanded(false);
  }

  const activeLabel = PORTFOLIO_PRESENTATION_PRESETS.find((preset) => preset.id === current)?.label;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">How should the portfolio feel?</h4>
          <p className="mt-1 text-sm text-gray-600">
            Choose a starting layout for grid, image framing, and card details. You can fine-tune below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {expanded ? 'Hide wizard' : 'Open setup wizard'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {PORTFOLIO_PRESENTATION_PRESETS.map((preset) => {
              const checked = selected === preset.id;
              return (
                <label
                  key={preset.id}
                  className={`flex cursor-pointer flex-col gap-2 rounded-md border p-3 transition-colors ${checked ? 'border-primary bg-white shadow-sm' : 'border-gray-200 bg-white/70 hover:border-gray-300'}`}
                >
                  <span className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="portfolio-presentation"
                      checked={checked}
                      onChange={() => setSelected(preset.id)}
                      className="mt-1 h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-900">{preset.label}</span>
                  </span>
                  <span className="text-xs text-gray-600">{preset.description}</span>
                  <span className="text-xs text-gray-500">{preset.bestFor}</span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={applySelection}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Apply presentation
            </button>
            <p className="text-xs text-gray-600">
              Updates grid and card chrome only. Categories stay as you set them.
            </p>
          </div>
        </>
      )}

      {!expanded && (
        <p className="text-xs text-gray-600">
          Active presentation: {activeLabel ?? 'Custom mix of layout settings'}
        </p>
      )}
    </div>
  );
}
