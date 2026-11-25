'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

function sanitizeDecimalDraft(raw: string): string {
  // Strip currency signs, commas, and whitespace so pasting "$1,250.50" works smoothly.
  const cleaned = raw.replaceAll('$', '').replaceAll(',', '').trim();
  let result = '';
  let seenDot = false;
  for (const ch of cleaned) {
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === '.' && !seenDot) {
      seenDot = true;
      result += result === '' ? '0.' : '.';
    }
  }
  return result;
}

function sanitizeIntegerDraft(raw: string): string {
  let result = '';
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') result += ch;
  }
  return result;
}

function formatNumberDraft(value: number | '' | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  return Number.isFinite(value) ? String(value) : '';
}

export function MoneyField({
  label,
  value,
  onChange,
  currencySymbol = '$',
  showCurrency = true,
  placeholder = '0',
  help,
  disabled = false,
  compact = false,
  labelHidden = false,
}: {
  label: string;
  value: number | '' | null | undefined;
  onChange: (value: number | '') => void;
  currencySymbol?: string;
  /** When false, renders a plain decimal field (e.g. ROAS ratios). */
  showCurrency?: boolean;
  placeholder?: string;
  help?: string;
  disabled?: boolean;
  compact?: boolean;
  /** Keep accessible label association while hiding visible label text (e.g. dense tables). */
  labelHidden?: boolean;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => formatNumberDraft(value));

  useEffect(() => {
    if (!focused) {
      setDraft(formatNumberDraft(value));
    }
  }, [value, focused]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextDraft = sanitizeDecimalDraft(event.target.value);
    setDraft(nextDraft);
    if (nextDraft === '') {
      onChange('');
      return;
    }
    const parsed = Number(nextDraft);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onChange(parsed);
    }
  }

  function handleBlur() {
    setFocused(false);
    if (draft === '' || draft === '.') {
      setDraft('');
      onChange('');
      return;
    }
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed >= 0) {
      const normalized = Math.round(parsed * 100) / 100;
      setDraft(String(normalized));
      onChange(normalized);
    } else {
      setDraft(formatNumberDraft(value));
    }
  }

  return (
    <label htmlFor={id} className={`block font-medium ${compact ? 'text-xs text-gray-600' : 'text-sm text-gray-700'}`}>
      <span className={labelHidden ? 'sr-only' : undefined}>{label}</span>
      <div className={`relative ${labelHidden ? '' : 'mt-1'}`}>
        {showCurrency ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500"
          >
            {currencySymbol}
          </span>
        ) : null}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={draft}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`block h-10 w-full rounded-md border border-gray-300 py-2 pr-3 text-sm font-normal ${showCurrency ? 'pl-7' : 'px-3'} disabled:cursor-not-allowed`}
        />
      </div>
      {help && !labelHidden ? <span className="mt-1 block text-xs font-normal text-gray-500">{help}</span> : null}
    </label>
  );
}

export function IntegerField({
  label,
  value,
  onChange,
  min = 0,
  max,
  placeholder = '',
  help,
  disabled = false,
  compact = false,
  labelHidden = false,
}: {
  label: string;
  value: number | '' | null | undefined;
  onChange: (value: number | '') => void;
  min?: number;
  max?: number;
  placeholder?: string;
  help?: string;
  disabled?: boolean;
  compact?: boolean;
  /** Keep accessible label association while hiding visible label text (e.g. dense tables). */
  labelHidden?: boolean;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => formatNumberDraft(value));

  useEffect(() => {
    if (!focused) {
      setDraft(formatNumberDraft(value));
    }
  }, [value, focused]);

  function clamp(num: number): number {
    let next = Math.floor(num);
    if (next < min) next = min;
    if (typeof max === 'number' && next > max) next = max;
    return next;
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextDraft = sanitizeIntegerDraft(event.target.value);
    setDraft(nextDraft);
    if (nextDraft === '') {
      onChange('');
      return;
    }
    const parsed = Number.parseInt(nextDraft, 10);
    if (!Number.isFinite(parsed)) return;
    // Keep the visible draft free while typing, but never publish out-of-range values to parents.
    if (parsed < min) return;
    if (typeof max === 'number' && parsed > max) return;
    onChange(parsed);
  }

  function handleBlur() {
    setFocused(false);
    if (draft === '') {
      onChange('');
      return;
    }
    const parsed = Number.parseInt(draft, 10);
    if (Number.isFinite(parsed)) {
      const clamped = clamp(parsed);
      setDraft(String(clamped));
      onChange(clamped);
    } else {
      setDraft(formatNumberDraft(value));
    }
  }

  return (
    <label htmlFor={id} className={`block font-medium ${compact ? 'text-xs text-gray-600' : 'text-sm text-gray-700'}`}>
      <span className={labelHidden ? 'sr-only' : undefined}>{label}</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={draft}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`${labelHidden ? '' : 'mt-1 '}block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal disabled:cursor-not-allowed`}
      />
      {help && !labelHidden ? <span className="mt-1 block text-xs font-normal text-gray-500">{help}</span> : null}
    </label>
  );
}

function appendUniqueTags(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((tag) => tag.trim().toLowerCase()));
  const next = [...existing];
  for (const raw of incoming) {
    const clean = raw.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next;
}

export function TagInput({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder = 'Type a tag and press Enter or comma',
  help,
}: {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  help?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const tags = Array.isArray(value) ? value : [];

  function commitRaw(raw: string) {
    const parts = raw.split(',').map((item) => item.trim()).filter(Boolean);
    if (parts.length > 0) {
      onChange(appendUniqueTags(tags, parts));
    }
    setDraft('');
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    if (next.includes(',')) {
      const segments = next.split(',');
      const trailing = segments.pop() ?? '';
      const completed = segments.map((segment) => segment.trim()).filter(Boolean);
      if (completed.length > 0) {
        onChange(appendUniqueTags(tags, completed));
      }
      setDraft(trailing.trimStart());
      return;
    }
    setDraft(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      if (draft.trim()) {
        event.preventDefault();
        commitRaw(draft);
      }
      return;
    }
    if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  const selectedKeys = new Set(tags.map((tag) => tag.toLowerCase()));
  const availableSuggestions = suggestions
    .filter((suggestion) => suggestion.trim() && !selectedKeys.has(suggestion.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div className="block text-sm font-medium text-gray-700">
      <label htmlFor={id} className="block">
        {label}
      </label>
      <div
        onClick={() => inputRef.current?.focus()}
        className="mt-1 flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={(event) => {
                event.stopPropagation();
                onChange(tags.filter((item) => item !== tag));
              }}
              className="rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) commitRaw(draft);
          }}
          placeholder={tags.length === 0 ? placeholder : 'Add another…'}
          className="min-w-[10rem] flex-1 border-0 bg-transparent p-1 text-sm font-normal text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
        />
      </div>
      {help ? <span className="mt-1 block text-xs font-normal text-gray-500">{help}</span> : null}
      {availableSuggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-normal text-gray-500">Existing:</span>
          {availableSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onChange(appendUniqueTags(tags, [suggestion]))}
              className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-normal text-gray-700 hover:border-gray-300 hover:bg-gray-100"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CUSTOM_OPTION_VALUE = '__custom__';

/**
 * Creatable single-select used for Category, Medium, and any similar Studio field:
 * existing options in a native dropdown, plus an inline “add new…” path for one-off values.
 */
export function CategorySelectField({
  label,
  value,
  options,
  onChange,
  help,
  emptyLabel,
  addOptionLabel = '+ Add new category…',
  customPlaceholder = 'e.g. Postcards, Sculptures',
  customInputAriaLabel = 'New category name',
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  help?: string;
  /** When set, shows a leading blank option so the field can stay unset (e.g. Medium). */
  emptyLabel?: string;
  addOptionLabel?: string;
  customPlaceholder?: string;
  customInputAriaLabel?: string;
}) {
  const id = useId();
  const [addingCustom, setAddingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  const dedupedOptions = (() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of [...options, value]) {
      const clean = raw.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(clean);
    }
    return list;
  })();

  const matchedValue =
    dedupedOptions.find((option) => option.toLowerCase() === value.trim().toLowerCase()) || '';

  function applyCustom() {
    const clean = customDraft.trim();
    if (!clean) return;
    onChange(clean);
    setCustomDraft('');
    setAddingCustom(false);
  }

  return (
    <div className="block text-sm font-medium text-gray-700">
      <label htmlFor={id} className="block">
        {label}
      </label>
      <select
        id={id}
        value={addingCustom ? CUSTOM_OPTION_VALUE : matchedValue}
        onChange={(event) => {
          if (event.target.value === CUSTOM_OPTION_VALUE) {
            setAddingCustom(true);
            return;
          }
          setAddingCustom(false);
          onChange(event.target.value);
        }}
        className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
      >
        {emptyLabel !== undefined && (
          <option value="">{emptyLabel}</option>
        )}
        {dedupedOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={CUSTOM_OPTION_VALUE}>{addOptionLabel}</option>
      </select>
      {addingCustom && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={customDraft}
            onChange={(event) => setCustomDraft(event.target.value)}
            onBlur={() => {
              if (customDraft.trim()) applyCustom();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyCustom();
              }
            }}
            placeholder={customPlaceholder}
            aria-label={customInputAriaLabel}
            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm font-normal"
            autoFocus
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyCustom}
            disabled={!customDraft.trim()}
            className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setAddingCustom(false);
              setCustomDraft('');
            }}
            className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      )}
      {help ? <span className="mt-1 block text-xs font-normal text-gray-500">{help}</span> : null}
    </div>
  );
}
