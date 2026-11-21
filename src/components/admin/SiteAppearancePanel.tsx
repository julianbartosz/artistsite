'use client';

import React, { useEffect, useState } from 'react';
import MediaPickerModal from '@/components/admin/MediaPickerModal';
import { extractSwatchesFromImageUrl } from '@/lib/color-extract';
import {
  FONT_PRESETS,
  FONT_PRESET_VALUES,
  PAGE_TONES,
  SHAPE_VARIABLES,
  SITE_LOOKBOOKS,
  THEME_PALETTES,
  applySiteLookbook,
  detectSiteLookbook,
  ensureContrast,
  normalizeHexColor,
  suggestBrandColorsFromSwatches,
  themeContrastIssues,
  type CardStyle,
  type PageTone,
  type SiteTheme,
  type SpacingDensity,
  type ThemeContrastIssue,
} from '@/lib/site-content-shared';

type ColorRole = ThemeContrastIssue['role'];

const COLOR_FIELD: Record<ColorRole, 'primaryColor' | 'accentColor'> = {
  primary: 'primaryColor',
  accent: 'accentColor',
};

const SHAPE_OPTIONS: Array<{ value: CardStyle; label: string; description: string }> = [
  { value: 'gallery', label: 'Gallery', description: 'Square corners, no frames' },
  { value: 'studio', label: 'Studio', description: 'Soft corners, light shadow' },
  { value: 'bold', label: 'Bold', description: 'Pill buttons, deeper cards' },
];

const SPACING_OPTIONS: Array<{ value: SpacingDensity; label: string; description: string }> = [
  { value: 'comfortable', label: 'Comfortable', description: 'Generous space between sections' },
  { value: 'compact', label: 'Compact', description: 'Tighter rhythm, more above the fold' },
];

const PAGE_TONE_ORDER: PageTone[] = ['white', 'soft', 'warm'];

function sameColor(left: string, right: string): boolean {
  return normalizeHexColor(left, '').toLowerCase() === normalizeHexColor(right, '').toLowerCase();
}

function choiceClass(selected: boolean): string {
  return `rounded-lg border bg-white text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
    selected ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-400'
  }`;
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-gray-600">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ColorPicker({
  label,
  help,
  value,
  issue,
  issueLabel,
  onChange,
}: {
  label: string;
  help: string;
  value: string;
  issue?: ThemeContrastIssue;
  issueLabel: string;
  onChange: (value: string) => void;
}) {
  const normalized = normalizeHexColor(value, '#000000');
  const [hexDraft, setHexDraft] = useState(normalized);

  useEffect(() => setHexDraft(normalized), [normalized]);

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start gap-3">
        <input
          type="color"
          value={normalized}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-md border border-gray-300 bg-white p-0.5"
          aria-label={`${label} picker`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-600">{help}</p>
        </div>
        <input
          value={hexDraft}
          onChange={(event) => {
            const next = event.target.value.trim();
            setHexDraft(next);
            const candidate = next.startsWith('#') ? next : `#${next}`;
            if (normalizeHexColor(candidate, '')) onChange(candidate.toLowerCase());
          }}
          onBlur={() => setHexDraft(normalized)}
          aria-label={`${label} hex value`}
          spellCheck={false}
          className="w-[5.5rem] shrink-0 rounded-md border border-gray-300 px-2 py-1 font-mono text-xs uppercase text-gray-700"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" role="status">
        {issue ? (
          <>
            <span className="text-amber-800">{issueLabel} ({issue.ratio.toFixed(1)}:1)</span>
            <button
              type="button"
              onClick={() => onChange(issue.suggestion)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1 font-medium text-gray-800 hover:bg-gray-50"
            >
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: issue.suggestion }} aria-hidden />
              Use readable version
            </button>
          </>
        ) : (
          <span className="text-green-700">✓ Easy to read</span>
        )}
      </div>
    </div>
  );
}

type SiteAppearancePanelProps = {
  theme: SiteTheme;
  savedTheme: SiteTheme;
  onChange: (theme: SiteTheme) => void;
  /** Portfolio images offered first in Match an artwork. */
  artworkChoices: Array<{ url: string; label: string }>;
};

export default function SiteAppearancePanel({ theme, savedTheme, onChange, artworkChoices }: SiteAppearancePanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [swatchTarget, setSwatchTarget] = useState<ColorRole>('primary');
  const [paletteNote, setPaletteNote] = useState<string | null>(null);

  const activeLook = detectSiteLookbook(theme);
  const issues = themeContrastIssues(theme);
  const issueFor = (role: ColorRole) => issues.find((issue) => issue.role === role);
  const swatches = theme.artworkPalette.swatches;
  const changed = JSON.stringify(theme) !== JSON.stringify(savedTheme);

  function update(patch: Partial<SiteTheme>) {
    onChange({ ...theme, ...patch });
  }

  async function matchArtwork(url: string) {
    setExtracting(true);
    setPaletteNote(null);
    try {
      const extracted = await extractSwatchesFromImageUrl(url);
      const suggestion = extracted ? suggestBrandColorsFromSwatches(extracted, theme.pageTone) : null;
      if (!extracted || !suggestion) {
        setPaletteNote('Could not read colors from that image. Try one with richer color.');
        return;
      }
      update({ ...suggestion, artworkPalette: { image: url, swatches: extracted } });
      setPaletteNote('Matched your artwork. Tap a swatch to change the main or highlight color.');
    } finally {
      setExtracting(false);
    }
  }

  const readableSwatch = (swatch: string) =>
    ensureContrast(swatch, swatchTarget === 'primary' ? '#ffffff' : PAGE_TONES[theme.pageTone].page);

  function assignSwatch(swatch: string) {
    const readable = readableSwatch(swatch);
    update({ [COLOR_FIELD[swatchTarget]]: readable });
    setPaletteNote(sameColor(readable, swatch) ? null : 'Deepened slightly so text on it stays easy to read.');
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">Changes show in the preview right away. Save to publish.</p>
        {changed && (
          <button
            type="button"
            onClick={() => {
              onChange(savedTheme);
              setPaletteNote(null);
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Undo appearance changes
          </button>
        )}
      </div>

      <Group title="Looks" hint="A complete starting point for colors, type, shape, and page tone. Adjust anything below after.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SITE_LOOKBOOKS.map((look) => {
            const selected = activeLook === look.id;
            const shape = SHAPE_VARIABLES[look.theme.cardStyle];
            return (
              <button
                key={look.id}
                type="button"
                onClick={() => onChange(applySiteLookbook(theme, look.id))}
                aria-pressed={selected}
                className={`${choiceClass(selected)} overflow-hidden`}
              >
                <div
                  className="flex h-16 items-center gap-3 border-b border-gray-100 px-3"
                  style={{ backgroundColor: PAGE_TONES[look.theme.pageTone].page }}
                  aria-hidden
                >
                  <span
                    className="text-3xl leading-none"
                    style={{ fontFamily: FONT_PRESETS[look.theme.fontPreset].heading, color: look.theme.accentColor }}
                  >
                    Aa
                  </span>
                  <span className="ml-auto h-6 w-14" style={{ backgroundColor: look.theme.primaryColor, borderRadius: shape['--radius-button'] }} />
                </div>
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{look.label}</p>
                  <p className="text-xs text-gray-600">{look.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Colors">
        <div className="flex flex-wrap gap-2">
          {THEME_PALETTES.map((palette) => {
            const selected = sameColor(palette.primaryColor, theme.primaryColor) && sameColor(palette.accentColor, theme.accentColor);
            return (
              <button
                key={palette.name}
                type="button"
                onClick={() => update({ primaryColor: palette.primaryColor, accentColor: palette.accentColor })}
                aria-pressed={selected}
                className={`${choiceClass(selected)} inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-gray-800`}
              >
                <span className="inline-flex overflow-hidden rounded-full" aria-hidden>
                  <span className="h-4 w-4" style={{ backgroundColor: palette.primaryColor }} />
                  <span className="h-4 w-4" style={{ backgroundColor: palette.accentColor }} />
                </span>
                {palette.name}
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-dashed border-gray-300 p-3">
          <div className="flex flex-wrap items-center gap-3">
            {theme.artworkPalette.image && (
              <img src={theme.artworkPalette.image} alt="" className="h-12 w-12 rounded-md object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{swatches.length > 0 ? 'Your palette' : 'Match an artwork'}</p>
              <p className="text-xs text-gray-600">
                {swatches.length > 0
                  ? 'Colors from your work, kept so you can come back to them.'
                  : 'Pick a painting and get colors that come straight from it.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={extracting}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {extracting ? 'Reading colors…' : swatches.length > 0 ? 'Match another artwork' : 'Choose artwork'}
            </button>
          </div>

          {swatches.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="inline-flex rounded-md border border-gray-300 p-0.5 text-xs" role="group" aria-label="Swatch applies to">
                {(['primary', 'accent'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSwatchTarget(role)}
                    aria-pressed={swatchTarget === role}
                    className={`inline-flex min-h-9 items-center rounded px-3 font-medium ${swatchTarget === role ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {role === 'primary' ? 'Set main color' : 'Set highlight'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {swatches.map((swatch) => {
                  const inUse = sameColor(readableSwatch(swatch), theme[COLOR_FIELD[swatchTarget]]);
                  return (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => assignSwatch(swatch)}
                      aria-pressed={inUse}
                      title={`Use ${swatch.toUpperCase()} as the ${swatchTarget === 'primary' ? 'main color' : 'highlight'}`}
                      className={`h-10 w-10 rounded-full border-2 transition-transform hover:scale-105 ${inUse ? 'border-gray-900' : 'border-white shadow ring-1 ring-gray-200'}`}
                      style={{ backgroundColor: swatch }}
                    >
                      <span className="sr-only">{swatch}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {paletteNote && <p className="mt-2 text-xs text-gray-600" role="status">{paletteNote}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ColorPicker
            label="Main color"
            help="Buttons, active links, and the footer"
            value={theme.primaryColor}
            issue={issueFor('primary')}
            issueLabel="White text on it is hard to read"
            onChange={(primaryColor) => update({ primaryColor })}
          />
          <ColorPicker
            label="Highlight"
            help="Second line of your homepage headline"
            value={theme.accentColor}
            issue={issueFor('accent')}
            issueLabel="Hard to read on your pages"
            onChange={(accentColor) => update({ accentColor })}
          />
        </div>
      </Group>

      <Group title="Type">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FONT_PRESET_VALUES.map((value) => {
            const preset = FONT_PRESETS[value];
            const selected = theme.fontPreset === value;
            return (
              <button key={value} type="button" onClick={() => update({ fontPreset: value })} aria-pressed={selected} className={`${choiceClass(selected)} p-3`}>
                <span className="block text-xl text-gray-900" style={{ fontFamily: preset.heading }}>{preset.label}</span>
                <span className="mt-1 block text-xs text-gray-600" style={{ fontFamily: preset.body }}>{preset.description}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Shape" hint="Corners for buttons, fields, and cards across the site.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SHAPE_OPTIONS.map((option) => {
            const shape = SHAPE_VARIABLES[option.value];
            const selected = theme.cardStyle === option.value;
            return (
              <button key={option.value} type="button" onClick={() => update({ cardStyle: option.value })} aria-pressed={selected} className={`${choiceClass(selected)} p-3`}>
                <span className="mb-3 flex items-center gap-2" aria-hidden>
                  <span className="h-6 w-12 bg-gray-800" style={{ borderRadius: shape['--radius-button'] }} />
                  <span className="h-6 flex-1 border border-gray-300 bg-white" style={{ borderRadius: shape['--radius-input'] }} />
                </span>
                <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                <span className="block text-xs text-gray-600">{option.description}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Page tone" hint="The paper your work sits on.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PAGE_TONE_ORDER.map((value) => {
            const tone = PAGE_TONES[value];
            const selected = theme.pageTone === value;
            return (
              <button key={value} type="button" onClick={() => update({ pageTone: value })} aria-pressed={selected} className={`${choiceClass(selected)} overflow-hidden`}>
                <span className="flex h-10 border-b border-gray-100" aria-hidden>
                  <span className="flex-[2]" style={{ backgroundColor: tone.page }} />
                  <span className="flex-1" style={{ backgroundColor: tone.muted }} />
                  <span className="flex-1" style={{ backgroundColor: tone.sunken }} />
                </span>
                <span className="block px-3 pt-2 text-sm font-medium text-gray-900">{tone.label}</span>
                <span className="block px-3 pb-2 text-xs text-gray-600">{tone.description}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Spacing">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SPACING_OPTIONS.map((option) => {
            const selected = theme.spacingDensity === option.value;
            return (
              <button key={option.value} type="button" onClick={() => update({ spacingDensity: option.value })} aria-pressed={selected} className={`${choiceClass(selected)} p-3`}>
                <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                <span className="block text-xs text-gray-600">{option.description}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => void matchArtwork(url)}
        title="Match an artwork"
        suggested={{ heading: 'Your portfolio', items: artworkChoices }}
      />
    </div>
  );
}
