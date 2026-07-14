import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    // Keep the declaration module graph instead of trying to roll three public
    // entry points into one file. Rollup mode left the `protocol`/`workshop`
    // entry declarations pointing at helper `.d.ts` files that were not emitted.
    dts({
      entryRoot: 'src',
      outDir: 'dist',
      rollupTypes: false,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'protocol/index': resolve(__dirname, 'src/protocol/index.ts'),
        'workshop/index': resolve(__dirname, 'src/workshop/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'js' : 'cjs';
        return `${entryName}.${ext}`;
      },
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
});
