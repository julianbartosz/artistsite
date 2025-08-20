// filepath: src/ui/components/commerce/filters/CheckboxGroup.tsx
'use client';
import React from 'react';

interface CheckboxOption {
  label: string;
  value: string;
}

interface CheckboxGroupProps {
  name: string;
  options: Array<string | CheckboxOption>;
  selected: string[];
  onChange: (value: string, checked: boolean) => void;
}

export default function CheckboxGroup({ name, options, selected, onChange }: CheckboxGroupProps) {
  return (
    <div className="space-y-3">
      {options.map((opt) => {
        const o: CheckboxOption = typeof opt === 'string' ? { label: opt, value: opt } : opt;
        const checked = selected.includes(o.value);
        return (
          <label key={o.value} className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              name={name}
              checked={checked}
              onChange={(e) => onChange(o.value, e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}
