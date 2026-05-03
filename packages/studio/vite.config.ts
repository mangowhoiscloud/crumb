/**
 * Vite config for the v2 Studio client (M0 scaffold).
 *
 * Static SPA bundle served by the existing Node http server (server.ts).
 * Output goes to `dist/client-v2/` which the server reads at startup and
 * serves at `/?app=v2`. The legacy `studio.{html,css,js}` bundle remains
 * the default until M7.1 (`?app=v2` flip).
 *
 * Constraints (per migration plan §13.1 portability invariants):
 * - `base: '/'` — never a host-coupled absolute path
 * - `build.sourcemap: 'hidden'` — no abs-path leakage in production bundles
 * - no symlinks anywhere in the resolution chain
 *
 * Bundle budget (per §13.3.1 CI gate, enforced by future "Vite build" CI):
 * - entry chunk ≤ 80 kB gz
 * - total initial load ≤ 240 kB gz
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwind()],
  root: resolve(import.meta.dirname, 'src/client-v2'),
  base: '/',
  build: {
    outDir: resolve(import.meta.dirname, 'dist/client-v2'),
    emptyOutDir: true,
    sourcemap: 'hidden',
    target: 'es2022',
    rollupOptions: {
      output: {
        // Stable hashed names so the bundle-inventory CI gate (M6) can pin
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
