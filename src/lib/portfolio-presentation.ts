import type { PortfolioPageContent } from '@/lib/site-content-shared';

export const PORTFOLIO_PRESENTATION_PRESET_IDS = [
  'quiet-wall',
  'gallery-grid',
  'dense-catalog',
] as const;

export type PortfolioPresentationPresetId = (typeof PORTFOLIO_PRESENTATION_PRESET_IDS)[number];

export type PortfolioPresentationPreset = {
  id: PortfolioPresentationPresetId;
  label: string;
  description: string;
  bestFor: string;
};

export const PORTFOLIO_PRESENTATION_PRESETS: readonly PortfolioPresentationPreset[] = [
  {
    id: 'quiet-wall',
    label: 'Quiet wall',
    description: 'Two columns, full artwork in frame, minimal chrome. Filters stay available once you add categories.',
    bestFor: 'Small bodies of work, or a calm first impression',
  },
  {
    id: 'gallery-grid',
    label: 'Gallery grid',
    description: 'Classic three-column wall with cropped thumbnails and category filters when you define them.',
    bestFor: 'Most portfolios — clear, familiar browsing',
  },
  {
    id: 'dense-catalog',
    label: 'Dense catalog',
    description: 'Four columns with medium, size, and year on each card so visitors can scan quickly.',
    bestFor: 'Larger catalogs and research-minded collectors',
  },
] as const;

export function applyPortfolioPresentationPreset(
  portfolio: PortfolioPageContent,
  presetId: PortfolioPresentationPresetId,
): PortfolioPageContent {
  if (presetId === 'quiet-wall') {
    return {
      ...portfolio,
      layout: {
        ...portfolio.layout,
        gridColumns: '2',
        masonry: false,
        imageFit: 'contain',
        thumbAspect: 'portrait',
        showFilters: true,
        showFeaturedBadge: false,
        showSoldBadge: false,
        showMeta: false,
        showPrice: false,
      },
      artworkDetailLayout: 'gallery-focus',
    };
  }

  if (presetId === 'dense-catalog') {
    return {
      ...portfolio,
      layout: {
        ...portfolio.layout,
        gridColumns: '4',
        masonry: false,
        imageFit: 'cover',
        thumbAspect: 'square',
        showFilters: true,
        showFeaturedBadge: true,
        showSoldBadge: true,
        showMeta: true,
        showPrice: false,
      },
      artworkDetailLayout: 'standard',
    };
  }

  return {
    ...portfolio,
    layout: {
      ...portfolio.layout,
      gridColumns: '3',
      masonry: false,
      imageFit: 'cover',
      thumbAspect: 'square',
      showFilters: true,
      showFeaturedBadge: true,
      showSoldBadge: false,
      showMeta: true,
      showPrice: false,
    },
    artworkDetailLayout: 'standard',
  };
}

export function detectPortfolioPresentationPreset(
  portfolio: PortfolioPageContent,
): PortfolioPresentationPresetId | null {
  const { layout, artworkDetailLayout } = portfolio;

  if (
    layout.gridColumns === '2'
    && layout.imageFit === 'contain'
    && layout.thumbAspect === 'portrait'
    && !layout.showMeta
    && !layout.showFeaturedBadge
    && artworkDetailLayout === 'gallery-focus'
  ) {
    return 'quiet-wall';
  }

  if (
    layout.gridColumns === '4'
    && layout.imageFit === 'cover'
    && layout.showMeta
    && artworkDetailLayout === 'standard'
  ) {
    return 'dense-catalog';
  }

  if (
    layout.gridColumns === '3'
    && layout.imageFit === 'cover'
    && layout.thumbAspect === 'square'
    && layout.showMeta
    && artworkDetailLayout === 'standard'
  ) {
    return 'gallery-grid';
  }

  return null;
}
