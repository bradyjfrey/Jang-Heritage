import type { Config } from 'tailwindcss'

// Palette and font tokens lifted directly from `mockups/_shared.css` so
// React components can copy class strings verbatim from the mockup HTML.
const config: Config = {
  content: [
    './src/app/(frontend)/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FAF6EF',
        'paper-warm': '#F5EFE0',
        surface: '#FFFFFF',
        ink: '#2A1F1A',
        'ink-soft': '#6B5D52',
        'ink-faint': '#9C8E81',
        seal: '#8B2D29',
        'seal-soft': '#B25652',
        gold: '#A8843E',
        'gold-soft': '#C9A865',
        'border-soft': '#E5DCC8',
        'border-strong': '#C8B998',
      },
      fontFamily: {
        cjk: [
          '"PingFang SC"',
          '"Noto Sans CJK SC"',
          '"Source Han Sans SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
        'serif-content': [
          '"Source Serif 4"',
          '"Lora"',
          '"Iowan Old Style"',
          'Georgia',
          'serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config
