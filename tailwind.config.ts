import type { Config } from 'tailwindcss';

/**
 * Tailwind is used by the admin panel only (the storefront uses styles.css / shop.css).
 * Tokens are the spec 15 palette: Deep Forest sidebar, Cream content, White cards with Beige borders.
 */
export default {
  content: ['./app/admin/**/*.{ts,tsx}', './components/admin/**/*.{ts,tsx}', './components/ui/**/*.{ts,tsx}', './components/store/OrderParts.tsx'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#183F32',
          forest: '#12352B',
          cream: '#F5F0E6',
          beige: '#DCCFB8',
          gold: '#C6A566',
          'gold-dark': '#7D6435',
          ink: '#1D2924',
          muted: '#5B6660',
        },
        state: {
          success: '#2F6B4F',
          warning: '#8A5A12',
          error: '#9B2C2C',
        },
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-jost)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { btn: '6px', card: '12px' },
      boxShadow: { card: '0 8px 24px rgba(18, 53, 43, 0.08)' },
      keyframes: {
        flash: { '0%': { backgroundColor: 'rgba(184,155,99,0.35)' }, '100%': { backgroundColor: 'transparent' } },
      },
      animation: { flash: 'flash 2s ease-out' },
    },
  },
  plugins: [],
} satisfies Config;
