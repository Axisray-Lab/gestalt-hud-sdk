import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Separate build config that produces a single UMD bundle for the
 * workshop entry point. This file is consumed via `<script>` tags
 * by mod developers who don't use a bundler.
 *
 * Usage: vite build --config vite.config.workshop-umd.ts
 * Output: dist/workshop.umd.js
 * Global: window.GestaltHUD
 */
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/workshop/index.ts'),
      name: 'GestaltHUD',
      formats: ['umd'],
      fileName: () => 'workshop.umd.js',
    },
  },
});
