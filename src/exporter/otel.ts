/**
 * OTel GenAI exporter — transcript Message → OpenTelemetry GenAI Semantic Conventions span.
 *
 * Aliases only (deterministic, no LLM). 2026-03 OTel GenAI is experimental, so we
 * isolate the alias map here — if attribute keys rename, this is the single point of update.
 *
 * Also emits Anthropic Console-compatible trace (loose JSON, parent_event_id chain) and
 * Chrome Trace Event Format (chrome://tracing) — Crumb actor maps to per-thread lane.
 *
 * See [[bagelcode-system-architecture-v0.1]] §10.3 (alias matrix),
 *     [[bagelcode-observability-frontier-2026]] §3 (verbatim attribute list),
 *     https://opentelemetry.io/docs/specs/semconv/gen-ai/
 */

import type { Actor, Message } from '../protocol/types.js';

export type ExportFormat = 'otel-jsonl' | 'anthropic-trace' | 'chrome-trace';

export interface OtelSpan {
  span_id: string;
  trace_id: string;
  parent_span_id?: string;
  start_time_unix_nano: number;
  end_time_unix_nano?: number;
  name: string;
  attributes: Record<string, unknown>;
}

const NS_PER_MS = 1_000_000;

/**
 * Alias a transcript message into an OTel GenAI span. Field-mapping only — no
 * computation beyond timestamp arithmetic.
 */
export function toOtelSpan(msg: Message): OtelSpan {
  const startNs = parseTimestampNs(msg.ts);
  const md = msg.metadata;
  // gen_ai.conversation.id / gen_ai.agent.id / gen_ai.workflow.name follow the
  // OTel GenAI Semantic Conventions: prefer explicit metadata.gen_ai aliases,
  // then fall back to transcript-native identifiers. workflow.name defaults to
  // 'crumb.coordinator' so spans always carry a stable workflow grouping.
  const attrs: Record<string, unknown> = {
    'gen_ai.conversation.id': md?.gen_ai?.conversation_id ?? msg.session_id,
    'gen_ai.agent.id': md?.gen_ai?.agent_id ?? msg.from,
    'gen_ai.agent.name': msg.from,
    'gen_ai.operation.name': msg.kind,
    'gen_ai.workflow.name': md?.gen_ai?.workflow_name ?? 'crumb.coordinator',
  };
  if (msg.task_id) attrs['gen_ai.task.id'] = msg.task_id;
  if (msg.to) attrs['gen_ai.agent.target'] = msg.to;
  if (msg.step) attrs['gen_ai.step'] = msg.step;

  if (md) {
    if (md.model) attrs['gen_ai.request.model'] = md.model;
    if (md.tokens_in !== undefined) attrs['gen_ai.usage.input_tokens'] = md.tokens_in;
    if (md.tokens_out !== undefined) attrs['gen_ai.usage.output_tokens'] = md.tokens_out;
    if (md.cache_read !== undefined) attrs['gen_ai.usage.cache_read_tokens'] = md.cache_read;
    if (md.cache_write !== undefined) attrs['gen_ai.usage.cache_write_tokens'] = md.cache_write;
    if (md.thinking_tokens !== undefined)
      attrs['gen_ai.usage.thinking_tokens'] = md.thinking_tokens;
    if (md.cost_usd !== undefined) attrs['gen_ai.cost.usd'] = md.cost_usd;
    if (md.harness) attrs['gen_ai.harness'] = md.harness;
    if (md.provider) attrs['gen_ai.provider'] = md.provider;
    if (md.tool) attrs['gen_ai.tool.name'] = md.tool;
    // Crumb-namespaced attrs (NeurIPS 2024 self-bias signal + 3-layer scoring marker)
    if (md.cross_provider !== undefined) attrs['crumb.cross_provider'] = md.cross_provider;
    if (md.deterministic !== undefined) attrs['crumb.deterministic'] = md.deterministic;
    if (md.audit_violations && md.audit_violations.length > 0) {
      attrs['crumb.audit_violations'] = md.audit_violations;
    }
  }
  // Tool call args / tool result output — surface so observability platforms
  // (Datadog / Vertex / Anthropic Console) can render the "click tool call →
  // arguments / responses" pattern from the same export.
  if (msg.kind === 'tool.call' && msg.data) {
    attrs['gen_ai.tool.call.arguments'] = JSON.stringify(msg.data);
    if (typeof msg.data.tool_name === 'string') attrs['gen_ai.tool.name'] = msg.data.tool_name;
  }
  if (msg.kind === 'tool.result' && msg.data) {
    attrs['gen_ai.tool.call.output'] = JSON.stringify(msg.data);
  }
  // OTel general 'error.type' attribute for kind=error / audit so error-rate
  // dashboards (Datadog, Vertex) light up without re-deriving from kind.
  if (msg.kind === 'error') {
    attrs['error.type'] = (msg.data?.code as string | undefined) ?? msg.body ?? 'crumb.error';
  }
  if (msg.kind === 'audit') {
    attrs['error.type'] = 'crumb.audit_violation';
  }
  if (msg.scores?.aggregate !== undefined) attrs['crumb.score.aggregate'] = msg.scores.aggregate;
  if (msg.scores?.verdict) attrs['crumb.score.verdict'] = msg.scores.verdict;

  const span: OtelSpan = {
    span_id: msg.id,
    trace_id: msg.session_id,
    start_time_unix_nano: startNs,
    name: `${msg.from}/${msg.kind}`,
    attributes: attrs,
  };

  const parent = msg.parent_event_id ?? msg.in_reply_to ?? undefined;
  if (parent) span.parent_span_id = parent;

  if (md?.latency_ms !== undefined) {
    span.end_time_unix_nano = startNs + md.latency_ms * NS_PER_MS;
  }

  return span;
}

export interface AnthropicTrace {
  trace_id: string;
  events: Array<{
    id: string;
    parent_id?: string;
    timestamp: string;
    type: string;
    actor: string;
    target?: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export function toAnthropicTrace(msgs: Message[]): AnthropicTrace {
  const trace_id = msgs[0]?.session_id ?? 'unknown';
  return {
    trace_id,
    events: msgs.map((m) => {
      const evt: AnthropicTrace['events'][number] = {
        id: m.id,
        timestamp: m.ts,
        type: m.kind,
        actor: m.from,
      };
      const parent = m.parent_event_id ?? m.in_reply_to ?? undefined;
      if (parent) evt.parent_id = parent;
      if (m.to) evt.target = m.to;
      if (m.body) evt.body = m.body;
      if (m.metadata) evt.metadata = m.metadata as unknown as Record<string, unknown>;
      return evt;
    }),
  };
}

export interface ChromeTraceEvent {
  name: string;
  cat: string;
  ph: 'X' | 'i';
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: Record<string, unknown>;
}

const ACTOR_TID: Record<Actor, number> = {
  user: 1,
  coordinator: 2,
  'planner-lead': 3,
  researcher: 9,
  builder: 4,
  verifier: 5,
  'builder-fallback': 6,
  validator: 7,
  system: 8,
};

export function toChromeTrace(msgs: Message[]): { traceEvents: ChromeTraceEvent[] } {
  const traceEvents = msgs.map<ChromeTraceEvent>((m) => {
    const tsUs = Math.floor(parseTimestampNs(m.ts) / 1000);
    const lat = m.metadata?.latency_ms;
    const evt: ChromeTraceEvent = {
      name: `${m.from}/${m.kind}`,
      cat: m.kind,
      ph: lat !== undefined ? 'X' : 'i',
      ts: tsUs,
      pid: 1,
      tid: ACTOR_TID[m.from] ?? 9,
    };
    if (lat !== undefined) evt.dur = lat * 1000;
    const args: Record<string, unknown> = {};
    if (m.body) args.body = m.body;
    if (m.step) args.step = m.step;
    if (m.metadata?.model) args.model = m.metadata.model;
    if (m.metadata?.cost_usd !== undefined) args.cost_usd = m.metadata.cost_usd;
    if (m.metadata?.deterministic) args.deterministic = true;
    if (m.scores?.verdict) args.verdict = m.scores.verdict;
    if (Object.keys(args).length > 0) evt.args = args;
    return evt;
  });
  return { traceEvents };
}

export function serialize(format: ExportFormat, msgs: Message[]): string {
  switch (format) {
    case 'otel-jsonl':
      if (msgs.length === 0) return '';
      return msgs.map((m) => JSON.stringify(toOtelSpan(m))).join('\n') + '\n';
    case 'anthropic-trace':
      return JSON.stringify(toAnthropicTrace(msgs), null, 2) + '\n';
    case 'chrome-trace':
      return JSON.stringify(toChromeTrace(msgs), null, 2) + '\n';
  }
}

function parseTimestampNs(ts: string): number {
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return 0;
  return ms * NS_PER_MS;
}
