/**
 * Agent Narrative — stream-json bubble feed.
 *
 * Per DESIGN.md §4.5 — Claude-Code-style ⏺ assistant text · ⎿ tool
 * result · ✓ turn complete bubbles. Renders the SAME SSE source as the
 * Feed panel but filtered to actor-narrative events (not system /
 * coordinator routing notes).
 *
 * Independently dockable via dockview — drag a tab out into a separate
 * window (F6 absorbed per §0.0.2). State preserved across docking.
 *
 * §8.1 quality bar — empty / connecting / streaming / errored states all
 * rendered explicitly. M5b adds the inline grep / pause / clear actions.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useRef } from 'react';
import { useTranscriptStream, type TranscriptEvent } from '../hooks/useTranscriptStream';
import { useActiveSession } from '../stores/selection';

const NARRATIVE_KINDS = new Set([
  'agent.thought_summary',
  'note',
  'spec',
  'build',
  'step.socratic',
  'step.concept',
  'step.design',
  'step.research',
  'step.research.video',
  'step.builder',
  'step.qa',
  'step.judge',
  'verify.result',
]);

function bubbleGlyph(evt: TranscriptEvent): string {
  if (evt.kind.startsWith('step.')) return '⏺';
  if (evt.kind === 'verify.result' || evt.kind === 'note') return '⎿';
  if (evt.kind === 'spec' || evt.kind === 'build') return '⏺';
  return '·';
}

export function Narrative(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(150);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [stream.events.length]);

  if (!sessionId) {
    return <Empty>Select a session in the sidebar to tail its narrative.</Empty>;
  }

  const bubbles = stream.events.filter((e) => NARRATIVE_KINDS.has(e.kind));

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--canvas)',
      }}
    >
      <div
        style={{
          padding: '4px var(--space-3)',
          fontSize: 10,
          color: 'var(--ink-muted)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          borderBottom: '1px solid var(--hairline-soft)',
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'center',
        }}
      >
        <span>Agent narrative</span>
        <span style={{ color: 'var(--ink-tertiary)' }}>
          {bubbles.length}/{stream.events.length} bubbles
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            color:
              stream.status === 'streaming'
                ? 'var(--lime)'
                : stream.status === 'errored'
                  ? 'var(--audit-fg)'
                  : 'var(--ink-tertiary)',
          }}
        >
          {stream.status}
        </span>
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {bubbles.map((evt) => (
          <div
            key={evt.id}
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                color: `var(--actor-${evt.from}, var(--ink-muted))`,
                fontFamily: 'var(--font-mono)',
                width: 18,
                flex: '0 0 auto',
                textAlign: 'center',
              }}
            >
              {bubbleGlyph(evt)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--ink-subtle)',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  marginBottom: 2,
                }}
              >
                {evt.from} · {evt.kind}
              </div>
              <div
                style={{
                  color: 'var(--ink)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {evt.body ?? '(no body)'}
              </div>
            </div>
          </div>
        ))}
        {bubbles.length === 0 && (
          <div
            style={{ color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
          >
            no narrative bubbles yet — they appear as actors emit step.* / spec / build events
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 'var(--space-4)',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-tertiary)',
        background: 'var(--canvas)',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
}
