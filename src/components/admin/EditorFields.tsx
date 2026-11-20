'use client';

import React from 'react';
import RichTextEditor, { type RichTextMergeField } from '@/components/RichTextEditor';

const INPUT_CLASS = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-50 disabled:text-gray-500';

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
};

export function reorder<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  const current = next[index];
  next[index] = next[target];
  next[target] = current;
  return next;
}

export function TextField({
  label, value, onChange, help, placeholder, disabled, type = 'text', maxLength,
}: TextInputProps & { type?: 'text' | 'email' | 'url'; maxLength?: number }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} maxLength={maxLength} className={INPUT_CLASS} />
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </label>
  );
}

export function TextAreaField({ label, value, onChange, rows = 4, help, placeholder, disabled }: TextInputProps & { rows?: number }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} disabled={disabled} className={INPUT_CLASS} />
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </label>
  );
}

export function SelectField({ label, value, onChange, options, help, disabled }: Omit<TextInputProps, 'placeholder'> & { options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={INPUT_CLASS}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </label>
  );
}

export function CheckboxField({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (value: boolean) => void; help?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm font-medium text-gray-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300" />
      <span>
        {label}
        {help && <span className="block text-xs font-normal text-gray-500">{help}</span>}
      </span>
    </label>
  );
}

export function HtmlField({
  label, value, onChange, help, mergeFields,
}: { label: string; value: string; onChange: (value: string) => void; help?: string; mergeFields?: RichTextMergeField[] }) {
  return (
    <div>
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      {help && <p className="mt-1 mb-2 text-xs text-gray-500">{help}</p>}
      <div className="mt-1">
        <RichTextEditor value={value} onChange={onChange} mergeFields={mergeFields} />
      </div>
    </div>
  );
}

export function EditorSection({ title, children, defaultOpen = false, id }: { title: string; children: React.ReactNode; defaultOpen?: boolean; id?: string }) {
  return (
    <details id={id} open={defaultOpen} className="rounded-md border border-gray-200 p-4">
      <summary className="cursor-pointer font-semibold text-gray-900">{title}</summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}
