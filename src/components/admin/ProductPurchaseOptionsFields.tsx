'use client';

import { slugify } from '@/lib/admin-content';
import type { ProductCustomization, ProductVariant } from '@/lib/commerce';

type VariantGroupKey = 'sizes' | 'framing' | 'materials';

type PurchaseOptionsValue = {
  variants?: {
    sizes?: ProductVariant[];
    framing?: ProductVariant[];
    materials?: ProductVariant[];
  };
  customizations?: ProductCustomization[];
  commissionInfo?: {
    available: boolean;
    estimatedDays: number;
    priceRange: { min: number; max: number };
    requiresConsultation: boolean;
  } | null;
};

const GROUP_LABELS: Record<VariantGroupKey, string> = {
  sizes: 'Size options',
  framing: 'Framing options',
  materials: 'Material options',
};

function emptyVariant(prefix: string): ProductVariant {
  const id = `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    name: '',
    priceModifier: 0,
    available: true,
  };
}

function emptyCustomization(): ProductCustomization {
  return {
    id: `custom-${crypto.randomUUID().slice(0, 8)}`,
    name: '',
    type: 'select',
    required: false,
    options: [{ id: 'option-a', name: 'Included', price: 0 }],
  };
}

function slugId(name: string, fallback: string): string {
  return slugify(name) || fallback;
}

type ProductPurchaseOptionsFieldsProps = {
  value: PurchaseOptionsValue;
  onChange: (next: PurchaseOptionsValue) => void;
};

export default function ProductPurchaseOptionsFields({ value, onChange }: ProductPurchaseOptionsFieldsProps) {
  const variants = value.variants || {};
  const customizations = value.customizations || [];
  const commission = value.commissionInfo;

  function setGroup(key: VariantGroupKey, rows: ProductVariant[]) {
    const nextVariants = {
      ...variants,
      [key]: rows,
    };
    onChange({
      ...value,
      variants: nextVariants,
    });
  }

  function updateRow(key: VariantGroupKey, index: number, patch: Partial<ProductVariant>) {
    const rows = [...(variants[key] || [])];
    const current = rows[index];
    if (!current) return;
    const name = patch.name ?? current.name;
    rows[index] = {
      ...current,
      ...patch,
      id: slugId(name, current.id),
      name,
    };
    setGroup(key, rows);
  }

  function setCustomizations(next: ProductCustomization[]) {
    onChange({ ...value, customizations: next });
  }

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Purchase options</h3>
        <p className="mt-1 text-xs text-gray-500">
          Optional add-ons collectors choose on the product page and in Quick Look. Leave a group empty if it does not apply.
        </p>
      </div>

      {(Object.keys(GROUP_LABELS) as VariantGroupKey[]).map((key) => {
        const rows = variants[key] || [];
        return (
          <div key={key} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-800">{GROUP_LABELS[key]}</p>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:opacity-80"
                onClick={() => setGroup(key, [...rows, emptyVariant(key.slice(0, -1))])}
              >
                Add option
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="text-xs text-gray-500">None</p>
            ) : (
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={row.id} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_8rem_auto] md:items-end">
                    <label className="block text-xs font-medium text-gray-600">
                      Name
                      <input
                        value={row.name}
                        onChange={(event) => updateRow(key, index, { name: event.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Museum frame"
                      />
                    </label>
                    <label className="block text-xs font-medium text-gray-600">
                      Extra price
                      <input
                        type="number"
                        value={row.priceModifier}
                        onChange={(event) => updateRow(key, index, { priceModifier: Number(event.target.value) || 0 })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                      onClick={() => setGroup(key, rows.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="space-y-3 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Custom fields</p>
            <p className="text-xs text-gray-500">Dedication notes, binding style, edition picks, and similar extras.</p>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:opacity-80"
            onClick={() => setCustomizations([...customizations, emptyCustomization()])}
          >
            Add field
          </button>
        </div>
        {customizations.length === 0 ? (
          <p className="text-xs text-gray-500">None</p>
        ) : (
          customizations.map((field, index) => (
            <div key={field.id} className="space-y-2 rounded-md border border-gray-200 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <label className="block text-xs font-medium text-gray-600">
                  Label
                  <input
                    value={field.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      const next = [...customizations];
                      next[index] = { ...field, name, id: slugId(name, field.id) };
                      setCustomizations(next);
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Type
                  <select
                    value={field.type}
                    onChange={(event) => {
                      const type = event.target.value as ProductCustomization['type'];
                      const next = [...customizations];
                      next[index] = {
                        ...field,
                        type,
                        options: type === 'select'
                          ? (field.options?.length ? field.options : [{ id: 'option-a', name: 'Included', price: 0 }])
                          : undefined,
                      };
                      setCustomizations(next);
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="select">Dropdown</option>
                    <option value="input">Short text</option>
                    <option value="textarea">Long text</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 self-end pb-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) => {
                      const next = [...customizations];
                      next[index] = { ...field, required: event.target.checked };
                      setCustomizations(next);
                    }}
                  />
                  Required
                </label>
              </div>
              {field.type === 'select' && (
                <label className="block text-xs font-medium text-gray-600">
                  Options (one per line: Name or Name|+price)
                  <textarea
                    rows={3}
                    value={(field.options || []).map((option) => (
                      option.price ? `${option.name}|+${option.price}` : option.name
                    )).join('\n')}
                    onChange={(event) => {
                      const options = event.target.value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line, optionIndex) => {
                          const [rawName, rawPrice] = line.split('|');
                          const name = (rawName || '').trim();
                          const priceText = (rawPrice || '').replace('+', '').trim();
                          const price = Number(priceText) || 0;
                          return {
                            id: slugId(name, `option-${optionIndex + 1}`),
                            name,
                            price,
                          };
                        });
                      const next = [...customizations];
                      next[index] = { ...field, options };
                      setCustomizations(next);
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder={'Unframed\nSimple frame|+120'}
                  />
                </label>
              )}
              <button
                type="button"
                className="text-xs font-medium text-red-700 hover:opacity-80"
                onClick={() => setCustomizations(customizations.filter((_, rowIndex) => rowIndex !== index))}
              >
                Remove field
              </button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-4">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={Boolean(commission?.available)}
            onChange={(event) => {
              if (!event.target.checked) {
                onChange({ ...value, commissionInfo: null });
                return;
              }
              onChange({
                ...value,
                commissionInfo: {
                  available: true,
                  estimatedDays: commission?.estimatedDays || 45,
                  priceRange: {
                    min: commission?.priceRange.min || 0,
                    max: commission?.priceRange.max || 0,
                  },
                  requiresConsultation: commission?.requiresConsultation ?? true,
                },
              });
            }}
          />
          Offer commissions for similar pieces
        </label>
        {commission?.available && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <label className="block text-xs font-medium text-gray-600">
              From price
              <input
                type="number"
                value={commission.priceRange.min}
                onChange={(event) => onChange({
                  ...value,
                  commissionInfo: {
                    ...commission,
                    priceRange: { ...commission.priceRange, min: Number(event.target.value) || 0 },
                  },
                })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              To price
              <input
                type="number"
                value={commission.priceRange.max}
                onChange={(event) => onChange({
                  ...value,
                  commissionInfo: {
                    ...commission,
                    priceRange: { ...commission.priceRange, max: Number(event.target.value) || 0 },
                  },
                })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Est. days
              <input
                type="number"
                value={commission.estimatedDays}
                onChange={(event) => onChange({
                  ...value,
                  commissionInfo: {
                    ...commission,
                    estimatedDays: Number(event.target.value) || 0,
                  },
                })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
