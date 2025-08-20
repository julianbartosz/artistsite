// filepath: src/ui/components/commerce/filters/FilterSection.tsx
'use client';
import React from 'react';

export interface FilterSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function FilterSection({ title, isOpen, onToggle, children }: FilterSectionProps) {
  return (
    <div className="border-b border-gray-200 pb-6 mb-6 last:border-b-0 last:pb-0 last:mb-0">
      <button onClick={onToggle} className="flex items-center justify-between w-full py-2 text-left">
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
        <span className="h-4 w-4 text-gray-500" aria-hidden="true">
          {isOpen ? '▴' : '▾'}
        </span>
      </button>
      {isOpen && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default FilterSection;
