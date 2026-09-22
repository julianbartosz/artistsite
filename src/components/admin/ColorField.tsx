'use client';

import React, { useState } from 'react';
import { extractPaletteFromImageUrl } from '@/lib/color-extract';
import type { CardStyle, FontPreset, SpacingDensity } from '@/lib/site-content-shared';
import {
  FONT_PRESET_FAMILIES,
  normalizeHexColor,
  whiteTextContrastOnPrimary,
} from '@/lib/site-content-shared';

export const THEME_COLOR_PRESETS = [
  { name: 'Charcoal', primary: '#111827', accent: '#374151' },
  { name: 'Warm ivory', primary: '#78350f', accent: '#92400e' },
  { name: 'Terracotta', primary: '#9a3412', accent: '#c2410c' },
  { name: 'Sage', primary: '#365314', accent: '#4d7c0f' },
  { name: 'Ocean', primary: '#1e3a5f', accent: '#2563eb' },
  { name: 'Plum', primary: '#581c87', accent: '#7e22ce' },
  { name: 'Rose', primary: '#881337', accent: '#be123c' },
  { name: 'Slate', primary: '#334155', accent: '#64748b' },
] as const;

export const CARD_STYLE_OPTIONS: Array<{ value: CardStyle; label: string; description: string }> = [
  { value: 'gallery', label: 'Gallery', description: 'Flat, edge-to-edge — minimal frames' },
  { value: 'studio', label: 'Studio', description: 'Soft corners and light shadow' },
  { value: 'bold', label: 'Bold', description: 'Rounded cards with stronger depth' },
];

const FONT_PRESET_OPTIONS: Array<{ value: FontPreset; label: string }> = [
  { value: 'system', label: 'Clean modern' },
  { value: 'serif', label: 'Classic elegant' },
  { value: 'modern', label: 'Simple sans-serif' },
];

const SPACING_DENSITY_OPTIONS: Array<{ value: SpacingDensity; label: string; description: string }> = [
  { value: 'comfortable', label: 'Comfortable', description: 'Generous spacing between sections' },
  { value: 'compact', label: 'Compact', description: 'Tighter rhythm — more content above the fold' },
];

function presetMatchesTheme(
  preset: { primary: string; accent: string },
  primaryColor: string,
  accentColor: string,
): boolean {
  return (
    normalizeHexColor(preset.primary, '') === normalizeHexColor(primaryColor, '')
    && normalizeHexColor(preset.accent, '') === normalizeHexColor(accentColor, '')
  );
}

function presetNameForColor(hex: string): string | null {
  const normalized = normalizeHexColor(hex, '');
  const match = THEME_COLOR_PRESETS.find(
    (preset) => normalizeHexColor(preset.primary, '') === normalized
      || normalizeHexColor(preset.accent, '') === normalized,
  );
  return match?.name ?? null;
}

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
};

export default function ColorField({ label, value, onChange, help }: ColorFieldProps) {
  const normalized = normalizeHexColor(value, '#111827');
  const presetName = presetNameForColor(value);

  return (
    <div className="block text-sm font-medium text-gray-700">
      <span>{label}</span>
      <div className="mt-1 flex items-center gap-3">
        <input
          type="color"
          value={normalized}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-14 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
          aria-label={`${label} picker`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900">{presetName ?? 'Custom color'}</p>
          <p className="text-xs text-gray-500">Tap the swatch to choose any color</p>
        </div>
      </div>
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </div>
  );
}

type SitePreviewMockProps = {
  siteDisplayName: string;
  navLabels: string[];
  primary: string;
  accent: string;
  fontPreset: FontPreset;
  cardStyle: CardStyle;
};

function SitePreviewMock({
  siteDisplayName,
  navLabels,
  primary,
  accent,
  fontPreset,
  cardStyle,
}: SitePreviewMockProps) {
  const cardRadius = cardStyle === 'gallery' ? '0' : cardStyle === 'bold' ? '0.75rem' : '0.5rem';
  const cardShadow = cardStyle === 'gallery' ? 'none' : cardStyle === 'bold' ? '0 4px 6px rgb(0 0 0 / 0.08)' : '0 1px 2px rgb(0 0 0 / 0.06)';

  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200 bg-white"
      style={{ fontFamily: FONT_PRESET_FAMILIES[fontPreset] }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: primary }}>
        <span className="truncate text-sm font-semibold text-white">{siteDisplayName}</span>
        <div className="hidden gap-2 sm:flex">
          {navLabels.slice(0, 3).map((label) => (
            <span key={label} className="text-xs text-white/90">{label}</span>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: primary }}>
            Button
          </span>
          <span className="text-xs font-medium underline" style={{ color: accent }}>Link</span>
        </div>
        <div
          className="h-16 bg-gray-100"
          style={{ borderRadius: cardRadius, boxShadow: cardShadow, border: cardStyle === 'gallery' ? 'none' : '1px solid rgb(229 231 235)' }}
          aria-hidden
        />
      </div>
      <div className="px-3 py-2 text-xs text-white/90" style={{ backgroundColor: primary }}>
        Footer
      </div>
    </div>
  );
}

type ThemeColorEditorProps = {
  primaryColor: string;
  accentColor: string;
  onPrimaryChange: (value: string) => void;
  onAccentChange: (value: string) => void;
  onApplyPalette: (primary: string, accent: string) => void;
  fontPreset: FontPreset;
  onFontPresetChange: (value: FontPreset) => void;
  cardStyle: CardStyle;
  onCardStyleChange: (value: CardStyle) => void;
  spacingDensity: SpacingDensity;
  onSpacingDensityChange: (value: SpacingDensity) => void;
  siteDisplayName: string;
  navPreviewLabels: string[];
  paletteSourceImage?: string;
  canRevert?: boolean;
  onRevert?: () => void;
};

export function ThemeColorEditor({
  primaryColor,
  accentColor,
  onPrimaryChange,
  onAccentChange,
  onApplyPalette,
  fontPreset,
  onFontPresetChange,
  cardStyle,
  onCardStyleChange,
  spacingDensity,
  onSpacingDensityChange,
  siteDisplayName,
  navPreviewLabels,
  paletteSourceImage,
  canRevert,
  onRevert,
}: ThemeColorEditorProps) {
  const primary = normalizeHexColor(primaryColor, '#111827');
  const accent = normalizeHexColor(accentColor, '#374151');
  const [paletteMessage, setPaletteMessage] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const contrast = whiteTextContrastOnPrimary(primary);

  async function suggestFromPhoto() {
    if (!paletteSourceImage?.trim()) {
      setPaletteMessage('Add a portrait on the Home or Bio page first, then try again.');
      return;
    }

    setExtracting(true);
    setPaletteMessage(null);
    try {
      const palette = await extractPaletteFromImageUrl(paletteSourceImage);
      if (!palette) {
        setPaletteMessage('Could not read colors from that image. Try another photo with richer tones.');
        return;
      }
      onApplyPalette(palette.primary, palette.accent);
      setPaletteMessage('Applied colors from your photo.');
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">Changes preview live below and in the page preview. Save to publish.</p>
        {canRevert && onRevert && (
          <button
            type="button"
            onClick={onRevert}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Revert appearance
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-gray-600">Quick palettes</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEME_COLOR_PRESETS.map((preset) => {
            const selected = presetMatchesTheme(preset, primaryColor, accentColor);
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => onApplyPalette(preset.primary, preset.accent)}
                aria-pressed={selected}
                className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left text-xs text-gray-700 transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                title={`Apply ${preset.name}`}
              >
                <span className="inline-flex shrink-0 overflow-hidden rounded">
                  <span className="h-4 w-4" style={{ backgroundColor: preset.primary }} />
                  <span className="h-4 w-4" style={{ backgroundColor: preset.accent }} />
                </span>
                <span className="font-medium">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-gray-600">Card style</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CARD_STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onCardStyleChange(option.value)}
              aria-pressed={cardStyle === option.value}
              className={`rounded-md border p-3 text-left text-xs ${
                cardStyle === option.value
                  ? 'border-primary bg-primary/5 ring-2 ring-primary'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <p className="font-medium text-gray-900">{option.label}</p>
              <p className="mt-1 text-gray-600">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-gray-600">Section spacing</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SPACING_DENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSpacingDensityChange(option.value)}
              aria-pressed={spacingDensity === option.value}
              className={`rounded-md border p-3 text-left text-xs ${
                spacingDensity === option.value
                  ? 'border-primary bg-primary/5 ring-2 ring-primary'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <p className="font-medium text-gray-900">{option.label}</p>
              <p className="mt-1 text-gray-600">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-gray-600">Writing style</p>
        <div className="flex flex-wrap gap-2">
          {FONT_PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFontPresetChange(option.value)}
              aria-pressed={fontPreset === option.value}
              className={`rounded-md border px-3 py-2 text-sm ${
                fontPreset === option.value
                  ? 'border-primary bg-primary/5 ring-2 ring-primary'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              style={{ fontFamily: FONT_PRESET_FAMILIES[option.value] }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-900">Fine-tune colors</summary>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ColorField
            label="Main button color"
            value={primaryColor}
            onChange={onPrimaryChange}
            help="Buttons, header accents, footer background."
          />
          <ColorField
            label="Link & highlight color"
            value={accentColor}
            onChange={onAccentChange}
            help="Links, highlights, secondary accents."
          />
        </div>
      </details>

      {contrast !== 'pass' && (
        <p
          className={`rounded-md border px-3 py-2 text-xs ${
            contrast === 'fail'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
          role="status"
        >
          {contrast === 'fail'
            ? 'Button text may be hard to read on this color. Choose a darker main button color or a quick palette.'
            : 'Button contrast is acceptable for large text but may fail accessibility for small labels.'}
        </p>
      )}

      {paletteSourceImage !== undefined && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void suggestFromPhoto()}
            disabled={extracting || !paletteSourceImage?.trim()}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={!paletteSourceImage?.trim() ? 'Add a portrait on Home or Bio first' : undefined}
          >
            {extracting ? 'Analyzing photo…' : 'Suggest colors from your photo'}
          </button>
          {paletteMessage && <p className="text-xs text-gray-600">{paletteMessage}</p>}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-gray-600">Site preview</p>
        <SitePreviewMock
          siteDisplayName={siteDisplayName}
          navLabels={navPreviewLabels}
          primary={primary}
          accent={accent}
          fontPreset={fontPreset}
          cardStyle={cardStyle}
        />
      </div>
    </div>
  );
}
