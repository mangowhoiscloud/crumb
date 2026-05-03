/**
 * Density toggle — Comfortable / Compact (Datadog Notebook convention,
 * §6.6 of migration plan). Controls `<html data-density>` so token
 * variables in tokens.css resolve to tighter spacing in compact mode.
 */

import { useEffect, useState } from 'react';

const KEY = 'crumb.studio.density';

type Density = 'comfortable' | 'compact';

function readInitial(): Density {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'comfortable' || stored === 'compact') return stored;
  } catch (_) {
    /* localStorage may be blocked */
  }
  return 'comfortable';
}

export function DensityToggle() {
  const [density, setDensity] = useState<Density>(() => readInitial());

  useEffect(() => {
    if (density === 'compact') {
      document.documentElement.dataset.density = 'compact';
    } else {
      delete document.documentElement.dataset.density;
    }
    try {
      localStorage.setItem(KEY, density);
    } catch (_) {
      /* localStorage may be blocked */
    }
  }, [density]);

  return (
    <button
      type="button"
      onClick={() => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))}
      aria-label="Toggle density"
      title={density === 'compact' ? 'Switch to comfortable density' : 'Switch to compact density'}
      style={{
        background: 'transparent',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-sm)',
        padding: '4px 10px',
        fontSize: 12,
        cursor: 'pointer',
        color: 'var(--ink-muted)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {density === 'compact' ? '⊟' : '⊞'}
    </button>
  );
}
