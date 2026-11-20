import type { BioPageContent, BioSectionKey } from '@/lib/site-content-shared';
import { DEFAULT_BIO_PAGE, normalizeBioSectionOrder } from '@/lib/site-content-shared';

export const BIO_NARRATIVE_PRESET_IDS = ['statement-first', 'process-led', 'cv-traditional'] as const;
export type BioNarrativePresetId = (typeof BIO_NARRATIVE_PRESET_IDS)[number];

export type BioNarrativePreset = {
  id: BioNarrativePresetId;
  label: string;
  description: string;
  bestFor: string;
};

export const BIO_NARRATIVE_PRESETS: readonly BioNarrativePreset[] = [
  {
    id: 'statement-first',
    label: 'Statement first',
    description: 'Lead with who you are and what you make. Hide résumé blocks until you have something real to put there.',
    bestFor: 'Early career, self-taught, or anyone skipping the CV for now',
  },
  {
    id: 'process-led',
    label: 'Process and studio',
    description: 'Pair your statement with how you work. Still no pressure to list schools or awards.',
    bestFor: 'Artists who want visitors to understand their materials and practice',
  },
  {
    id: 'cv-traditional',
    label: 'Traditional CV',
    description: 'Turn on background, exhibitions, and collections sections so you can fill a classic artist résumé.',
    bestFor: 'Artists with education, shows, or press ready to publish',
  },
] as const;

/** Known sample credentials from earlier product defaults — clear these on preset apply. */
const DEMO_BIO_MARKERS = [
  'Yale School of Art',
  'Rhode Island School of Design',
  'MoMA PS1',
  'Whitney Biennial',
  'Museum of Contemporary Art, Chicago',
  'Artforum',
  'Long Island City',
] as const;

export function bioContainsDemoCredentials(bio: BioPageContent): boolean {
  const blob = [
    bio.backgroundHtml,
    bio.achievementsHtml,
    bio.collectionsHtml,
    bio.studioPracticeHtml,
    bio.artistStatementHtml,
  ].join('\n');
  return DEMO_BIO_MARKERS.some((marker) => blob.includes(marker));
}

function orderForPreset(id: BioNarrativePresetId): BioSectionKey[] {
  if (id === 'process-led') {
    return normalizeBioSectionOrder(['statement', 'studio', 'background', 'achievements', 'collections', 'cta']);
  }
  if (id === 'cv-traditional') {
    return normalizeBioSectionOrder(['statement', 'background', 'achievements', 'studio', 'collections', 'cta']);
  }
  return normalizeBioSectionOrder(['statement', 'studio', 'background', 'achievements', 'collections', 'cta']);
}

function clearDemoOrEmpty(html: string, forceClear: boolean): string {
  if (forceClear) return '';
  if (DEMO_BIO_MARKERS.some((marker) => html.includes(marker))) return '';
  return html;
}

/**
 * Applies a presentation narrative: section visibility, order, and titles.
 * Clears demo CV filler so day-one artists are not stuck with fake prestige.
 * Does not invent new body copy — artists write their own.
 */
export function applyBioNarrativePreset(
  bio: BioPageContent,
  presetId: BioNarrativePresetId,
): BioPageContent {
  const clearCv = presetId !== 'cv-traditional' || bioContainsDemoCredentials(bio);
  const clearStudioDemo = bioContainsDemoCredentials(bio);

  const next: BioPageContent = {
    ...bio,
    sectionOrder: orderForPreset(presetId),
    statementTitle: bio.statementTitle.trim() || DEFAULT_BIO_PAGE.statementTitle,
    backgroundTitle: presetId === 'cv-traditional'
      ? (bio.backgroundTitle.trim() || DEFAULT_BIO_PAGE.backgroundTitle)
      : bio.backgroundTitle,
    achievementsTitle: presetId === 'cv-traditional'
      ? (bio.achievementsTitle.trim() || DEFAULT_BIO_PAGE.achievementsTitle)
      : bio.achievementsTitle,
    studioTitle: presetId === 'process-led'
      ? (bio.studioTitle.trim() || 'How I work')
      : (bio.studioTitle.trim() || DEFAULT_BIO_PAGE.studioTitle),
    collectionsTitle: bio.collectionsTitle.trim() || DEFAULT_BIO_PAGE.collectionsTitle,
    backgroundHtml: clearDemoOrEmpty(bio.backgroundHtml, clearCv && presetId !== 'cv-traditional'),
    achievementsHtml: clearDemoOrEmpty(bio.achievementsHtml, clearCv && presetId !== 'cv-traditional'),
    collectionsHtml: clearDemoOrEmpty(bio.collectionsHtml, clearCv && presetId !== 'cv-traditional'),
    studioPracticeHtml: clearDemoOrEmpty(bio.studioPracticeHtml, clearStudioDemo && presetId === 'statement-first'),
    artistStatementHtml: clearDemoOrEmpty(bio.artistStatementHtml, false),
    showCta: true,
  };

  if (presetId === 'statement-first') {
    next.showStatement = true;
    next.showStudio = false;
    next.showBackground = false;
    next.showAchievements = false;
    next.showCollections = false;
    if (clearStudioDemo) {
      next.studioImage = '';
      next.studioImageAlt = '';
    }
  } else if (presetId === 'process-led') {
    next.showStatement = true;
    next.showStudio = true;
    next.showBackground = false;
    next.showAchievements = false;
    next.showCollections = false;
  } else {
    next.showStatement = true;
    next.showStudio = true;
    next.showBackground = true;
    next.showAchievements = true;
    next.showCollections = true;
    if (bioContainsDemoCredentials(bio)) {
      next.backgroundHtml = '';
      next.achievementsHtml = '';
      next.collectionsHtml = '';
      next.studioPracticeHtml = clearDemoOrEmpty(bio.studioPracticeHtml, true);
      next.artistStatementHtml = clearDemoOrEmpty(bio.artistStatementHtml, true);
    }
  }

  if (
    bio.hero.portraitImage === '/images/artist-portrait.jpg'
    || (clearStudioDemo && presetId === 'statement-first')
  ) {
    if (bio.hero.portraitImage === '/images/artist-portrait.jpg') {
      next.hero = { ...next.hero, portraitImage: '', portraitImageAlt: next.hero.portraitImageAlt || '' };
    }
  }

  if (bio.studioImage === '/images/artist-studio.jpg' && (presetId === 'statement-first' || clearStudioDemo)) {
    next.studioImage = '';
    next.studioImageAlt = '';
  }

  return next;
}

export function detectBioNarrativePreset(bio: BioPageContent): BioNarrativePresetId | null {
  const statement = bio.showStatement;
  const studio = bio.showStudio;
  const cv = bio.showBackground || bio.showAchievements || bio.showCollections;

  if (statement && studio && !cv) return 'process-led';
  if (statement && !studio && !cv) return 'statement-first';
  if (statement && studio && bio.showBackground && bio.showAchievements && bio.showCollections) {
    return 'cv-traditional';
  }
  return null;
}
