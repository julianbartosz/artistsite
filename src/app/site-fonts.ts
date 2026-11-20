import localFont from 'next/font/local';

/** Families behind the FONT_PRESETS pairings; only the active preset's files are fetched by the browser. */
export const inter = localFont({
  src: [
    { path: './fonts/inter-latin-wght-normal.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/inter-latin-wght-italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});

export const sourceSerif = localFont({
  src: [
    { path: './fonts/source-serif-4-latin-wght-normal.woff2', weight: '200 900', style: 'normal' },
    { path: './fonts/source-serif-4-latin-wght-italic.woff2', weight: '200 900', style: 'italic' },
  ],
  variable: '--font-source-serif',
  display: 'swap',
  preload: false,
});

export const fraunces = localFont({
  src: [{ path: './fonts/fraunces-latin-wght-normal.woff2', weight: '100 900', style: 'normal' }],
  variable: '--font-fraunces',
  display: 'swap',
  preload: false,
});

export const siteFontVariables = `${inter.variable} ${sourceSerif.variable} ${fraunces.variable}`;
