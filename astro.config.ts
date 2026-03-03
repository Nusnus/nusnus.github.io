import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://nusnus.github.io',

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },

  build: {
    assets: 'assets',
  },

  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
      wrap: true,
    },
  },
});
