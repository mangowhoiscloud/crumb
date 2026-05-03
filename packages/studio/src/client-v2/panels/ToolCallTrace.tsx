/**
 * ToolCallTrace — recursive-collapsible tool-call tree (PR-O5 surface).
 *
 * Per migration plan §6 + §0.0.2 PR-O5 absorption: surfaces dispatcher's
 * `tool.call` events (stream-json tap, see `src/dispatcher/live.ts:312`)
 * as a per-actor grouped, expandable view-pane tab.
 *
 * Today's transcript schema declares `tool.call` + `tool.result` (kind 39
 * + 40), but the dispatcher only emits `tool.call`. Once paired-emit
 * lands, the same render groups child results under their parent call by
 * `parent_event_id`. For now each tool.call is a leaf — duration is read
 * from `data.elapsed_ms`, the only ground-truth latency available.
 *
 * §8.1 quality bar:
 * - empty / no-events states explicit
 * - all rendered fields verbatim from server-side schema (no client
 *   derivation; §17 leak guard)
 * - actor color comes from `--actor-<actor>` token, not hardcoded
 */

import { useMemo, useState } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { useActiveSession } from '../stores/selection';
import { useTranscriptStream, type TranscriptEvent } from '../hooks/useTranscriptStream';

interface ToolCallNode {
  event: TranscriptEvent;
  toolKind: string;
  tool?: string;
  path?: string;
  elapsedMs?: number;
  children: ToolCallNode[];
}

interface ActorGroup {
  actor: string;
  calls: ToolCallNode[];
  totalElapsedMs: number;
  totalCount: number;
}

export function ToolCallTrace(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => buildGroups(stream.events), [stream.events]);
  const filtered = useMemo(() => {
    if (!filter) return groups;
    const f = filter.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        calls: g.calls.filter(
          (c) =>
            c.toolKind.toLowerCase().includes(f) ||
            (c.tool ?? '').toLowerCase().includes(f) ||
            (c.path ?? '').toLowerCase().includes(f) ||
            (c.event.body ?? '').toLowerCase().includes(f),
        ),
      }))
      .filter((g) => g.calls.length > 0);
  }, [groups, filter]);

  if (!sessionId) return <Empty>Select a session in the sidebar.</Empty>;

  const totalCalls = groups.reduce((a, g) => a + g.totalCount, 0);

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
          borderBottom: '1px solid var(--hairline-soft)',
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'center',
        }}
      >
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="grep · tool / path / body"
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--canvas)',
            color: 'var(--ink)',
          }}
        />
        <span
          style={{ fontSize: 10, color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}
        >
          {filtered.reduce((a, g) => a + g.calls.length, 0)}/{totalCalls}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-2) var(--space-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        {filtered.length === 0 ? (
          <span style={{ color: 'var(--ink-tertiary)' }}>(no tool.call events)</span>
        ) : (
          filtered.map((g) => (
            <ActorSection
              key={g.actor}
              group={g}
              collapsed={collapsed.has(g.actor)}
              onToggle={() => {
                const next = new Set(collapsed);
                if (next.has(g.actor)) next.delete(g.actor);
                else next.add(g.actor);
                setCollapsed(next);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ActorSection({
  group,
  collapsed,
  onToggle,
}: {
  group: ActorGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const lane = `var(--actor-${group.actor}, var(--ink-muted))`;
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: 'unset',
          cursor: 'pointer',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 0',
          borderBottom: '1px solid var(--hairline-soft)',
          color: 'var(--ink-strong)',
          fontWeight: 600,
        }}
      >
        <span aria-hidden style={{ color: 'var(--ink-tertiary)', width: 10 }}>
          {collapsed ? '▸' : '▾'}
        </span>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 'var(--r-pill)',
            background: lane,
          }}
        />
        <span style={{ color: lane }}>{group.actor}</span>
        <span style={{ color: 'var(--ink-tertiary)', fontWeight: 400 }}>
          {group.totalCount} call{group.totalCount === 1 ? '' : 's'}
          {group.totalElapsedMs > 0 && ` · ${formatMs(group.totalElapsedMs)}`}
        </span>
      </button>
      {!collapsed && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            paddingLeft: 18,
            marginTop: 4,
          }}
        >
          {group.calls.map((c) => (
            <CallRow key={c.event.id} node={c} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

function CallRow({ node, depth }: { node: ToolCallNode; depth: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 90px 1fr 56px',
        gap: 6,
        alignItems: 'baseline',
        paddingLeft: depth * 12,
        lineHeight: 1.6,
      }}
    >
      <span style={{ color: 'var(--ink-tertiary)' }}>
        {node.event.ts.split('T')[1]?.slice(0, 8)}
      </span>
      <span style={{ color: 'var(--ink-muted)' }} title={node.tool ?? node.toolKind}>
        {node.tool ?? node.toolKind}
      </span>
      <span style={{ color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.path ? <span style={{ color: 'var(--ink-muted)' }}>{node.path}</span> : null}
        {node.path && node.event.body ? ' · ' : ''}
        {node.event.body ? truncate(node.event.body, 120) : ''}
      </span>
      <span style={{ color: 'var(--ink-tertiary)', textAlign: 'right' }}>
        {node.elapsedMs ? formatMs(node.elapsedMs) : '—'}
      </span>
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

function buildGroups(events: TranscriptEvent[]): ActorGroup[] {
  const byActor = new Map<string, ToolCallNode[]>();
  const elapsedByActor = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== 'tool.call') continue;
    const data = (e.data ?? {}) as Record<string, unknown>;
    const node: ToolCallNode = {
      event: e,
      toolKind: typeof data.tool_kind === 'string' ? data.tool_kind : 'tool',
      tool: typeof data.tool === 'string' ? data.tool : undefined,
      path: typeof data.path === 'string' ? data.path : undefined,
      elapsedMs: typeof data.elapsed_ms === 'number' ? data.elapsed_ms : undefined,
      children: [],
    };
    if (!byActor.has(e.from)) byActor.set(e.from, []);
    byActor.get(e.from)!.push(node);
    if (node.elapsedMs) {
      elapsedByActor.set(e.from, (elapsedByActor.get(e.from) ?? 0) + node.elapsedMs);
    }
  }
  return [...byActor.entries()].map(([actor, calls]) => ({
    actor,
    calls,
    totalElapsedMs: elapsedByActor.get(actor) ?? 0,
    totalCount: calls.length,
  }));
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
