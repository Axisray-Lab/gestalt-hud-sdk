import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const CSP_META = /\s*<meta http-equiv="Content-Security-Policy"[^>]*>/i;

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'workshop-dev-csp',
      apply: 'serve',
      transformIndexHtml(html) {
        // Production keeps connect-src 'none'. Development strips only the
        // meta tag so Vite HMR can use its local WebSocket.
        return html.replace(CSP_META, '');
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
    open: true,
  },
});
