/**
 * Theme toggle — light / dark, with OS-preference fallback when no
 * explicit override is stored. Mirrors v1 vanilla studio.js initThemeToggle()
 * (PR #146 F3) so behavior is identical across the migration.
 *
 * Pre-paint script in index.html sets `<html data-theme>` before stylesheets
 * load (M3 will add it; for M2 we initialize on first render which is
 * acceptable since v2 is a preview build).
 */

import { useEffect, useState } from 'react';

const KEY = 'crumb.theme';

type Theme = 'light' | 'dark';

function readInitial(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) {
    /* localStorage may be blocked */
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readInitial());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch (_) {
      /* localStorage may be blocked */
    }
  }, [theme]);

  // Watch OS preference when no explicit user override (per F3 spec).
  useEffect(() => {
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent): void => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(KEY);
      } catch (_) {
        /* localStorage may be blocked */
      }
      if (!stored) setTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label="Toggle theme"
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        background: 'transparent',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-sm)',
        padding: '4px 10px',
        fontSize: 14,
        cursor: 'pointer',
        color: 'var(--ink-muted)',
      }}
    >
      {theme === 'dark' ? '☀' : '🌙'}
    </button>
  );
}
