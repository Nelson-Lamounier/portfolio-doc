import { defineConfig } from 'vite';
import viteReact from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    nodePolyfills({
      // @ts-expect-error: async_hooks is injected by our alias and polyfills but fails strict TS check
      include: ['async_hooks'],
      protocolImports: true,
      globals: {
        process: true,
      },
    }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'node:async_hooks': path.resolve(__dirname, './src/polyfills/async_hooks.js'),
    },
  },
});
