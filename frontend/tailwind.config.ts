import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',  // Updated path to include src directory
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config