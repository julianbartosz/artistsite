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
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
        },
        accent: 'var(--color-accent)',
      },
      fontFamily: {
        sans: ['var(--font-site)', 'var(--font-geist-sans)', 'Arial', 'Helvetica', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#374151',
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
              backgroundColor: '#eff6ff',
              color: '#1e40af',
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
              borderLeftColor: '#111827',
              borderLeftWidth: '4px',
              fontStyle: 'italic',
              color: '#4b5563',
            },
            a: {
              color: '#111827',
              textDecoration: 'underline',
              textDecorationColor: '#d1d5db',
              textUnderlineOffset: '2px',
              fontWeight: '500',
              '&:hover': {
                color: '#374151',
                textDecorationColor: '#9ca3af',
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