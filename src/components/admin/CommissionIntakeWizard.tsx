'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ContactInquiryKey, ContactInquiryType, ContactPageContent } from '@/lib/site-content-shared';
import {
  COMMISSION_INTAKE_OFFERS,
  applyCommissionIntake,
  commissionIntakeMatchesSelection,
  enabledInquiryKeys,
} from '@/lib/commission-intake';

type CommissionIntakeWizardProps = {
  contact: ContactPageContent;
  onApply: (nextContact: ContactPageContent) => void;
};

export default function CommissionIntakeWizard({ contact, onApply }: CommissionIntakeWizardProps) {
  const initialEnabled = useMemo(
    () => enabledInquiryKeys(contact.form.inquiryTypes),
    [contact.form.inquiryTypes],
  );
  const [selected, setSelected] = useState<ContactInquiryKey[]>(initialEnabled);
  const [expanded, setExpanded] = useState(initialEnabled.length === 0);

  useEffect(() => {
    setSelected(enabledInquiryKeys(contact.form.inquiryTypes));
  }, [contact.form.inquiryTypes]);

  const hasChanges = !commissionIntakeMatchesSelection(contact, selected);

  function toggleKey(key: ContactInquiryKey) {
    setSelected((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  }

  function applySelection() {
    if (selected.length === 0) return;
    onApply(applyCommissionIntake(contact, selected));
    setExpanded(false);
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">What should visitors contact you about?</h4>
          <p className="mt-1 text-sm text-gray-600">
            Choose the inquiry types you want on your contact form. You can still fine-tune labels below.
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {COMMISSION_INTAKE_OFFERS.map((offer) => {
              const checked = selected.includes(offer.key);
              return (
                <label
                  key={offer.key}
                  className={`flex cursor-pointer gap-3 rounded-md border p-3 transition-colors ${checked ? 'border-primary bg-white shadow-sm' : 'border-gray-200 bg-white/70 hover:border-gray-300'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleKey(offer.key)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{offer.title}</span>
                    <span className="mt-1 block text-xs text-gray-600">{offer.description}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={applySelection}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply to contact form
            </button>
            {selected.length === 0 && (
              <p className="text-xs text-amber-700">Select at least one inquiry type.</p>
            )}
            {hasChanges && selected.length > 0 && (
              <p className="text-xs text-gray-600">This updates visibility, order, and commission sidebar copy when needed.</p>
            )}
          </div>
        </>
      )}

      {!expanded && (
        <p className="text-xs text-gray-600">
          Active inquiry types:{' '}
          {normalizeVisibleLabels(contact.form.inquiryTypes).join(', ') || 'None selected yet'}
        </p>
      )}
    </div>
  );
}

function normalizeVisibleLabels(inquiryTypes: ContactInquiryType[]): string[] {
  return inquiryTypes.filter((item) => item.visible).map((item) => item.label);
}
