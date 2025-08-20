// filepath: src/ui/components/commerce/CustomCommissionRequest/CommissionTypeSelector.tsx
'use client';
import React from 'react';

type CommissionType = 'custom' | 'consultation' | 'similar';

export default function CommissionTypeSelector({ value, onChange }: { value: CommissionType; onChange: (v: CommissionType) => void; }) {
  const options = [
    { value: 'custom' as CommissionType, label: 'Original Custom Piece', desc: 'Create something entirely new' },
    { value: 'consultation' as CommissionType, label: 'Consultation First', desc: 'Discuss ideas before deciding' },
  ];
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">Commission Type</label>
      <div className="grid grid-cols-1 gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
              value === option.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              type="radio"
              name="commissionType"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value as CommissionType)}
              className="sr-only"
            />
            <div>
              <div className="font-medium text-gray-900">{option.label}</div>
              <div className="text-sm text-gray-500">{option.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
