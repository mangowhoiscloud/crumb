/**
 * Vite config for the Studio React client.
 *
 * Static SPA bundle served by the Node http server (server.ts). Output
 * goes to `dist/client/` which the server reads at startup and serves
 * at `/`. Legacy vanilla bundle was deleted in M8 along with the
 * `?app=v1` escape hatch.
 *
 * Constraints (per migration plan §13.1 portability invariants):
 * - `base: '/'` — never a host-coupled absolute path
 * - `build.sourcemap: 'hidden'` — no abs-path leakage in production bundles
 * - no symlinks anywhere in the resolution chain
 *
 * Bundle budget (per §13.3.1 CI gate):
 * - entry chunk ≤ 80 kB gz
 * - total initial load ≤ 240 kB gz
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwind()],
  root: resolve(import.meta.dirname, 'src/client'),
  base: '/',
  build: {
    outDir: resolve(import.meta.dirname, 'dist/client'),
    emptyOutDir: true,
    sourcemap: 'hidden',
    target: 'es2022',
    rollupOptions: {
      output: {
        // Stable hashed names so the bundle-inventory CI gate can pin
        // the file list across builds and detect accidental new chunks.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    // Dev-mode only — production traffic goes through server.ts at port 7321.
    port: 5173,
  },
});
