import type { Config } from "tailwindcss";

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        customGray: 'rgb(20 21 27 / 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
