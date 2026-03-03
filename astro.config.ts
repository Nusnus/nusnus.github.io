import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://nusnus.github.io',

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    server: {
      hmr: {
        port: 24678,
      },
      watch: {
        usePolling: true,
        interval: 300,
      },
    },
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
