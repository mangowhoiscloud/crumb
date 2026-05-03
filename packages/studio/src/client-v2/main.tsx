/**
 * M2 — Studio v2 React root. Loads global CSS (Tailwind v4 + Open Props
 * tokens + dockview theme), bootstraps theme + density attributes before
 * paint, then mounts the dockview shell.
 *
 * Real panel content lands in M3 onward; this file is the stable entry
 * point for every M-PR going forward.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import './styles/globals.css';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false, // SSE bridge already keeps cache live
    },
  },
});

// Theme + density bootstrap — runs before React renders so first paint
// resolves token vars correctly (FOUC prevention; mirrors v1 §3.2 spec).
(function bootstrapAttrs(): void {
  try {
    const stored = localStorage.getItem('crumb.theme');
    const auto =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    document.documentElement.dataset.theme = stored ?? auto;
  } catch (_) {
    document.documentElement.dataset.theme = 'light';
  }
  try {
    const density = localStorage.getItem('crumb.studio.density');
    if (density === 'compact') document.documentElement.dataset.density = 'compact';
  } catch (_) {
    /* localStorage may be blocked */
  }
})();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('M2 shell: #root not found in index.html');
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
