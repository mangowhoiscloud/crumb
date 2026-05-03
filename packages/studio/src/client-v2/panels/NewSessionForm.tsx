/**
 * NewSessionForm — cascading harness × model new-session creation.
 *
 * Per DESIGN.md §4.3 and migration plan §6 (PR #143 redesign spec).
 * Layout:
 *   ┌── Goal (multi-line textarea) ─────────────────────────────┐
 *   ├── Preset chips (full-width row) ──────────────────────────┤
 *   └── (advanced) Per-actor cascade table:
 *         actor │ harness ▾ │ model ▾  (model disabled until harness picked)
 *
 * Cascading rules (DESIGN.md §4.3 state matrix):
 *   - Preset chip selected → bindings auto-fill (read-only badge)
 *   - Custom mode → harness dropdown active, model dropdown disabled until
 *     harness chosen
 *   - Harness picked → model dropdown populates with the harness's models
 *     only (filtered from adapterCache)
 *   - Unhealthy adapter → harness option visible with red dot; selecting
 *     it surfaces install/auth hint inline
 */

import { useMemo, useState } from 'react';
import { api, type AdapterStatus } from '../lib/api';

interface Props {
  adapters: AdapterStatus[];
  onSpawned: () => void;
}

const ACTORS = ['planner-lead', 'researcher', 'builder', 'verifier'] as const;
type Actor = (typeof ACTORS)[number];

interface Preset {
  id: string;
  label: string;
  description: string;
  requires: string[];
}

const PRESETS: Preset[] = [
  { id: '', label: 'ambient', description: 'follow the entry host', requires: [] },
  { id: 'mock', label: 'mock', description: 'deterministic, $0', requires: ['mock'] },
  {
    id: 'solo',
    label: 'solo',
    description: 'single host, single model',
    requires: ['claude-local'],
  },
  {
    id: 'bagelcode-cross-3way',
    label: 'cross-3way',
    description: 'builder=codex · verifier=gemini-cli · rest=ambient',
    requires: ['codex-local', 'gemini-cli-local'],
  },
  {
    id: 'sdk-enterprise',
    label: 'sdk-enterprise',
    description: 'API key direct',
    requires: ['gemini-sdk'],
  },
];

interface Binding {
  harness?: string;
  model?: string;
}

export function NewSessionForm({ adapters, onSpawned }: Props) {
  const [goal, setGoal] = useState('');
  const [preset, setPreset] = useState('');
  const [bindings, setBindings] = useState<Record<Actor, Binding>>({
    'planner-lead': {},
    researcher: {},
    builder: {},
    verifier: {},
  });
  const [feedback, setFeedback] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [pending, setPending] = useState(false);

  const installedAdapters = useMemo(
    () => adapters.filter((a) => a.installed && a.authenticated !== false),
    [adapters],
  );

  const presetIsRunnable = (p: Preset): boolean =>
    p.requires.every((req) => installedAdapters.some((a) => a.id === req));

  const submit = async (): Promise<void> => {
    if (!goal.trim()) {
      setFeedback({ text: 'goal is required', tone: 'err' });
      return;
    }
    setPending(true);
    setFeedback({ text: 'spawning crumb run…', tone: 'ok' });
    try {
      const body: { goal: string; preset?: string; bindings?: typeof bindings } = {
        goal: goal.trim(),
      };
      if (preset) body.preset = preset;
      // Only send bindings when the user customized any actor row.
      const customized = Object.values(bindings).some((b) => b.harness || b.model);
      if (customized && !preset) body.bindings = bindings;
      await api.spawnRun(body);
      setFeedback({ text: 'spawned. transcript will appear below.', tone: 'ok' });
      setGoal('');
      setPreset('');
      setBindings({ 'planner-lead': {}, researcher: {}, builder: {}, verifier: {} });
      onSpawned();
    } catch (err: unknown) {
      setFeedback({ text: (err as Error).message, tone: 'err' });
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
        background: 'var(--surface-card)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="game goal — e.g., '60s 고양이 퍼즐, 콤보 보너스 포함'"
        style={{
          width: '100%',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          padding: 'var(--space-2)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-sm)',
          background: 'var(--canvas)',
          color: 'var(--ink)',
          resize: 'vertical',
          minHeight: 60,
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {PRESETS.map((p) => {
          const runnable = presetIsRunnable(p);
          const active = preset === p.id;
          return (
            <button
              key={p.id || 'ambient'}
              type="button"
              disabled={!runnable}
              onClick={() => setPreset(p.id)}
              title={p.description + (p.requires.length ? ` · needs ${p.requires.join(', ')}` : '')}
              style={{
                ...presetChipStyle,
                background: active ? 'var(--surface-2)' : 'transparent',
                borderColor: active ? 'var(--primary)' : 'var(--hairline)',
                color: runnable ? 'var(--ink)' : 'var(--ink-tertiary)',
                opacity: runnable ? 1 : 0.4,
                cursor: runnable ? 'pointer' : 'not-allowed',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <details
        style={{ fontSize: 12 }}
        onToggle={(e) => {
          if (!(e.currentTarget as HTMLDetailsElement).open && !preset) setPreset('');
        }}
      >
        <summary style={{ cursor: 'pointer', color: 'var(--ink-muted)', userSelect: 'none' }}>
          Custom binding (per-actor harness × model)
        </summary>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr 1fr',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-3)',
            alignItems: 'center',
          }}
        >
          {ACTORS.map((actor) => {
            const harnessChoice = bindings[actor].harness ?? '';
            const harnessAdapter = installedAdapters.find((a) => a.id === harnessChoice);
            return (
              <ActorBindingRow
                key={actor}
                actor={actor}
                adapters={installedAdapters}
                harnessChoice={harnessChoice}
                modelChoice={bindings[actor].model ?? ''}
                harnessAdapter={harnessAdapter}
                onHarnessChange={(value) =>
                  setBindings((prev) => ({
                    ...prev,
                    [actor]: { harness: value, model: undefined },
                  }))
                }
                onModelChange={(value) =>
                  setBindings((prev) => ({ ...prev, [actor]: { ...prev[actor], model: value } }))
                }
              />
            );
          })}
        </div>
      </details>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !goal.trim()}
          style={{
            ...primaryBtnStyle,
            opacity: pending || !goal.trim() ? 0.5 : 1,
            cursor: pending || !goal.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? '…' : 'Run'}
        </button>
      </div>

      {feedback && (
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: feedback.tone === 'err' ? 'var(--audit-fg)' : 'var(--ink-subtle)',
          }}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}

function ActorBindingRow({
  actor,
  adapters,
  harnessChoice,
  modelChoice,
  harnessAdapter,
  onHarnessChange,
  onModelChange,
}: {
  actor: Actor;
  adapters: AdapterStatus[];
  harnessChoice: string;
  modelChoice: string;
  harnessAdapter: AdapterStatus | undefined;
  onHarnessChange: (value: string) => void;
  onModelChange: (value: string) => void;
}) {
  return (
    <>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
        }}
      >
        {actor}
      </span>
      <select
        value={harnessChoice}
        onChange={(e) => onHarnessChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">ambient</option>
        {adapters.map((a) => (
          <option key={a.id} value={a.id}>
            {a.display_name}
            {a.plan ? ` · ${a.plan}` : ''}
          </option>
        ))}
      </select>
      <select
        value={modelChoice}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={!harnessAdapter}
        style={{
          ...selectStyle,
          opacity: harnessAdapter ? 1 : 0.45,
          cursor: harnessAdapter ? 'pointer' : 'not-allowed',
        }}
      >
        {!harnessAdapter ? (
          <option value="">pick harness first</option>
        ) : (
          <>
            <option value="">default</option>
            {(harnessAdapter.models ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </>
        )}
      </select>
    </>
  );
}

const presetChipStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  padding: '4px 10px',
  borderRadius: 'var(--r-pill)',
  border: '1px solid var(--hairline)',
};

const selectStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  padding: '4px 8px',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-sm)',
  background: 'var(--canvas)',
  color: 'var(--ink)',
  width: '100%',
};

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--primary)',
  color: 'var(--surface-card)',
  fontSize: 13,
  fontWeight: 600,
  padding: 'var(--space-2) var(--space-4)',
  border: 'none',
  borderRadius: 'var(--r-sm)',
};
