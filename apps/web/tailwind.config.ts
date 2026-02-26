import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mh: {
          bg: 'var(--mh-bg)',
          surface: 'var(--mh-surface)',
          panel: 'var(--mh-panel)',
          text: 'var(--mh-text)',
          accent: 'var(--mh-accent)',
          accent2: 'var(--mh-accent-2)',
          accent3: 'var(--mh-accent-3)',
          border: 'var(--mh-border)'
        }
      }
    }
  }
};

export default config;
