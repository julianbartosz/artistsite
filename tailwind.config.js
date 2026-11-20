/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/content/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      // Theme colors are RGB channel variables so opacity modifiers (bg-primary/10) compile.
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover-rgb) / <alpha-value>)',
        },
        accent: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface-page-rgb) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted-rgb) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken-rgb) / <alpha-value>)',
        },
      },
      borderRadius: {
        button: 'var(--radius-button)',
        input: 'var(--radius-input)',
        card: 'var(--radius-card)',
      },
      fontFamily: {
        sans: ['var(--font-site)', 'ui-sans-serif', 'system-ui', 'Arial', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-site)', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#374151',
            'h1, h2, h3, h4': {
              fontFamily: 'var(--font-heading)',
            },
            h1: {
              color: '#111827',
              fontWeight: '700',
            },
            h2: {
              color: '#111827',
              fontWeight: '600',
            },
            h3: {
              color: '#111827',
              fontWeight: '600',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            code: {
              backgroundColor: 'var(--surface-sunken)',
              color: 'var(--color-primary)',
              paddingLeft: '0.25rem',
              paddingRight: '0.25rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            'blockquote p:first-of-type::before': {
              content: '""',
            },
            'blockquote p:last-of-type::after': {
              content: '""',
            },
            blockquote: {
              borderLeftColor: 'var(--color-primary)',
              borderLeftWidth: '4px',
              fontStyle: 'italic',
              color: '#4b5563',
            },
            a: {
              color: 'var(--color-primary)',
              textDecoration: 'underline',
              textDecorationColor: 'rgb(var(--color-primary-rgb) / 0.35)',
              textUnderlineOffset: '2px',
              fontWeight: '500',
              '&:hover': {
                textDecorationColor: 'var(--color-primary)',
              },
            },
            strong: {
              color: '#111827',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
  // Disable JIT mode temporarily to avoid file scanning issues
  mode: 'jit',
  corePlugins: {
    preflight: true,
  },
  // Disable experimental features that cause file system access
  experimental: {
    optimizeUniversalDefaults: false,
  },
}