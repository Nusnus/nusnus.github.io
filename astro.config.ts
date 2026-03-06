import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://nusnus.github.io',

  devToolbar: { enabled: false },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    build: {
      // Enable minification for production
      minify: 'esbuild',
      // Optimize CSS
      cssMinify: true,
      // Manual chunks for better code splitting
      rollupOptions: {
        output: {
          manualChunks: {
            // Separate React vendor chunk
            'react-vendor': ['react', 'react-dom'],
            // Separate mermaid (large library)
            mermaid: ['mermaid'],
          },
        },
      },
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'clsx', 'tailwind-merge'],
    },
  },

  build: {
    assets: 'assets',
    // Inline small assets to reduce requests
    inlineStylesheets: 'auto',
  },

  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
      wrap: true,
    },
  },
});
