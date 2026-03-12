/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0a0c',
          1: '#111114',
          2: '#18181c',
          3: '#222228',
          4: '#2a2a32',
        },
        accent: {
          DEFAULT: '#6ee7b7',
          dim: '#34d399',
          bright: '#a7f3d0',
        },
        muted: '#6b7280',
        border: '#2a2a32',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
