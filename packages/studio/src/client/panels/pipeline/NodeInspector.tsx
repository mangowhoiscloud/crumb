/**
 * NodeInspector — Detail Rail content when a Pipeline node is selected.
 *
 * Per migration plan §6.1: 6-section inspector — identity / binding /
 * live metrics / sandwich preview / style override / recent events.
 *
 * M4a (this PR) ships the first 2 sections — identity + binding — both
 * read-only. M5/M6 wire live metrics, sandwich preview, style override,
 * recent events. Each section JSDoc cites the AGENTS.md invariant it
 * respects.
 */

import {
  useActiveSession,
  useSelectedNodeActor,
  setSelectedNodeActor,
} from '../../stores/selection';
import { useSessions } from '../../hooks/useSessions';

const ACTOR_DESCRIPTIONS: Record<string, string> = {
  user: 'You. Issues the original goal; intervenes via the slash bar.',
  coordinator: 'Host-inline routing (Hub-Ledger-Spoke). Decides next_speaker per event.',
  'planner-lead': 'Spec authoring. Two-phase spawn: Socratic + Concept → Design + Synth.',
  researcher: 'Video evidence extractor. Gemini 3.1 Pro multimodal, 10fps frame sampling.',
  builder: 'Phaser 3.80 multi-file PWA implementer. Emits artifact.created + build.',
  verifier: 'CourtEval (Grader → Critic → Defender → Re-grader). Reads qa.result for D2/D6.',
  validator: 'Anti-deception schema enforcement. D2/D6 forced to 0 on inconsistent verdicts.',
  system: 'Dispatcher heartbeat: spawn / qa.result / hook effects. Never an LLM-driven actor.',
};

export function NodeInspector() {
  const actor = useSelectedNodeActor();
  const sessionId = useActiveSession();
  const sessions = useSessions();

  if (!actor) return null;

  const description = ACTOR_DESCRIPTIONS[actor] ?? '(no description)';
  const session = sessions.data?.sessions.find((s) => s.session_id === sessionId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--canvas)',
      }}
    >
      <Section title="Identity">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)' }}>
          {actor}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>{description}</div>
      </Section>

      <Section title="Active session">
        {session ? (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
              {session.session_id.slice(0, 12)}…
            </div>
            <div style={{ color: 'var(--ink)', marginTop: 4 }}>
              {session.goal ?? '(no goal yet)'}
            </div>
            {session.derived_state && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ink-subtle)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                state: {session.derived_state}
                {session.derived_state_reason ? ` · ${session.derived_state_reason}` : ''}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>
            no session selected — pick one in the sidebar
          </div>
        )}
      </Section>

      <Section title="Binding (M5)">
        <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>
          harness × model × effort lands here when M5 wires the per-actor binding store.
          Edit-from-inspector emits user.intervene to inbox.txt (preserves AGENTS.md read-only
          invariant 1 + 7).
        </div>
      </Section>

      <Section title="Live metrics (M5/M6)">
        <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>
          token / cost / latency p50/p95 / last step.* — server-derived from metrics.per_actor (§17
          audit fix). Client never recomputes.
        </div>
      </Section>

      <button
        type="button"
        onClick={() => setSelectedNodeActor(null)}
        style={{
          alignSelf: 'flex-start',
          background: 'transparent',
          border: '1px solid var(--hairline)',
          color: 'var(--ink-muted)',
          fontSize: 11,
          padding: '4px 10px',
          borderRadius: 'var(--r-sm)',
          cursor: 'pointer',
        }}
      >
        ← back to event detail
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          color: 'var(--ink-muted)',
          fontWeight: 600,
          margin: 0,
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}
