/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Premium developer-centric color palette
        brand: {
          50: '#f0f3ff',
          100: '#dbe2fe',
          200: '#bfcafd',
          300: '#9aa9fc',
          400: '#707df9',
          500: '#4f56f1', // Main brand indigo
          600: '#3c3be5',
          700: '#302ec9',
          800: '#2927a3',
          900: '#252582',
          950: '#15144c',
        },
        dark: {
          50: '#f6f6f7',
          100: '#e1e3e5',
          200: '#c2c6ca',
          300: '#9ba2a8',
          400: '#707981',
          500: '#565e65',
          600: '#41474d',
          700: '#32363b',
          800: '#232528',
          900: '#1a1b1e', // Dark background
          950: '#0d0e10', // Deepest dark
        },
        cyber: {
          blue: '#00d2ff',
          purple: '#b800ff',
          pink: '#ff007f',
          green: '#00ff66',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpath d='M 20 0 L 0 0 0 20' fill='none' stroke='%23ffffff' stroke-width='0.03' stroke-opacity='0.08'/%3E%3C/svg%3E\")",
        'grid-pattern-dark': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpath d='M 20 0 L 0 0 0 20' fill='none' stroke='%23ffffff' stroke-width='0.03' stroke-opacity='0.03'/%3E%3C/svg%3E\")",
      }
    },
  },
  plugins: [],
}
