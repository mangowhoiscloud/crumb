import { describe, expect, it } from 'vitest';

import type { Message } from '../protocol/types.js';

import { serialize, toAnthropicTrace, toChromeTrace, toOtelSpan } from './otel.js';

const judgeScore: Message = {
  id: '01J9X4EXAMPLE',
  ts: '2026-05-02T12:34:56.789Z',
  session_id: 'sess-abc',
  task_id: 'task_main',
  from: 'verifier',
  to: 'coordinator',
  parent_event_id: '01J9X3PARENT',
  kind: 'judge.score',
  step: 'regrader',
  metadata: {
    harness: 'gemini-cli',
    provider: 'google',
    model: 'gemini-2.5-pro',
    tokens_in: 5000,
    tokens_out: 1500,
    cache_read: 4500,
    cost_usd: 0.12,
    latency_ms: 4200,
    cross_provider: true,
    deterministic: false,
    audit_violations: [],
  },
  scores: { aggregate: 24.5, verdict: 'PASS' },
};

const qaResult: Message = {
  id: '01J9X4QA',
  ts: '2026-05-02T12:34:50.000Z',
  session_id: 'sess-abc',
  from: 'system',
  kind: 'qa.result',
  metadata: {
    deterministic: true,
    tool: 'qa-check-effect@v1',
  },
  data: {
    lint_passed: true,
    exec_exit_code: 0,
  },
};

describe('toOtelSpan', () => {
  it('aliases gen_ai.* attributes from metadata + scores', () => {
    const span = toOtelSpan(judgeScore);
    expect(span.span_id).toBe(judgeScore.id);
    expect(span.trace_id).toBe(judgeScore.session_id);
    expect(span.parent_span_id).toBe('01J9X3PARENT');
    expect(span.name).toBe('verifier/judge.score');
    expect(span.attributes['gen_ai.conversation.id']).toBe('sess-abc');
    expect(span.attributes['gen_ai.agent.id']).toBe('verifier');
    expect(span.attributes['gen_ai.agent.name']).toBe('verifier');
    expect(span.attributes['gen_ai.agent.target']).toBe('coordinator');
    expect(span.attributes['gen_ai.operation.name']).toBe('judge.score');
    expect(span.attributes['gen_ai.workflow.name']).toBe('crumb.coordinator');
    expect(span.attributes['gen_ai.step']).toBe('regrader');
    expect(span.attributes['gen_ai.task.id']).toBe('task_main');
    expect(span.attributes['gen_ai.request.model']).toBe('gemini-2.5-pro');
    expect(span.attributes['gen_ai.usage.input_tokens']).toBe(5000);
    expect(span.attributes['gen_ai.usage.output_tokens']).toBe(1500);
    expect(span.attributes['gen_ai.usage.cache_read_tokens']).toBe(4500);
    expect(span.attributes['gen_ai.cost.usd']).toBe(0.12);
    expect(span.attributes['gen_ai.harness']).toBe('gemini-cli');
    expect(span.attributes['gen_ai.provider']).toBe('google');
    expect(span.attributes['crumb.cross_provider']).toBe(true);
    expect(span.attributes['crumb.score.aggregate']).toBe(24.5);
    expect(span.attributes['crumb.score.verdict']).toBe('PASS');
  });

  it('explicit metadata.gen_ai aliases override defaults', () => {
    const msg: Message = {
      ...judgeScore,
      metadata: {
        ...judgeScore.metadata!,
        gen_ai: {
          conversation_id: 'otel-conv-override',
          agent_id: 'otel-agent-override',
          workflow_name: 'crumb.cross_provider_demo',
        },
      },
    };
    const span = toOtelSpan(msg);
    expect(span.attributes['gen_ai.conversation.id']).toBe('otel-conv-override');
    expect(span.attributes['gen_ai.agent.id']).toBe('otel-agent-override');
    expect(span.attributes['gen_ai.workflow.name']).toBe('crumb.cross_provider_demo');
  });

  it('tool.call surfaces gen_ai.tool.call.arguments + tool.name', () => {
    const tc: Message = {
      id: '01J9X4TC',
      ts: '2026-05-02T12:02:45.000Z',
      session_id: 'sess-abc',
      from: 'builder',
      kind: 'tool.call',
      data: { tool_name: 'write_file', path: 'game.html', bytes: 12_000 },
    };
    const span = toOtelSpan(tc);
    expect(span.attributes['gen_ai.tool.name']).toBe('write_file');
    expect(span.attributes['gen_ai.tool.call.arguments']).toContain('"path":"game.html"');
  });

  it('tool.result surfaces gen_ai.tool.call.output', () => {
    const tr: Message = {
      id: '01J9X4TR',
      ts: '2026-05-02T12:02:46.000Z',
      session_id: 'sess-abc',
      from: 'builder',
      kind: 'tool.result',
      data: { ok: true, sha256: 'a'.repeat(64) },
    };
    const span = toOtelSpan(tr);
    expect(span.attributes['gen_ai.tool.call.output']).toContain('"ok":true');
  });

  it('kind=error sets error.type for dashboard error-rate metrics', () => {
    const err: Message = {
      id: '01J9X4ER',
      ts: '2026-05-02T12:05:00.000Z',
      session_id: 'sess-abc',
      from: 'system',
      kind: 'error',
      body: 'adapter spawn failed',
      data: { code: 'F1_ADAPTER_SPAWN_FAIL' },
    };
    const span = toOtelSpan(err);
    expect(span.attributes['error.type']).toBe('F1_ADAPTER_SPAWN_FAIL');
  });

  it('kind=audit sets error.type=crumb.audit_violation', () => {
    const aud: Message = {
      id: '01J9X4AU',
      ts: '2026-05-02T12:05:30.000Z',
      session_id: 'sess-abc',
      from: 'validator',
      kind: 'audit',
      body: 'verify_pass_without_exec_zero',
    };
    const span = toOtelSpan(aud);
    expect(span.attributes['error.type']).toBe('crumb.audit_violation');
  });

  it('end_time_unix_nano = start + latency_ms', () => {
    const span = toOtelSpan(judgeScore);
    const startNs = Date.parse(judgeScore.ts) * 1_000_000;
    expect(span.start_time_unix_nano).toBe(startNs);
    expect(span.end_time_unix_nano).toBe(startNs + 4200 * 1_000_000);
  });

  it('omits end_time when latency missing', () => {
    const span = toOtelSpan(qaResult);
    expect(span.end_time_unix_nano).toBeUndefined();
  });

  it('emits crumb.deterministic for dispatcher-emitted ground truth', () => {
    const span = toOtelSpan(qaResult);
    expect(span.attributes['crumb.deterministic']).toBe(true);
  });
});

describe('toAnthropicTrace', () => {
  it('preserves parent_event_id chain across events', () => {
    const a: Message = { ...qaResult, id: 'a', parent_event_id: undefined };
    const b: Message = { ...judgeScore, id: 'b', parent_event_id: 'a' };
    const trace = toAnthropicTrace([a, b]);
    expect(trace.trace_id).toBe('sess-abc');
    expect(trace.events).toHaveLength(2);
    expect(trace.events[0]!.parent_id).toBeUndefined();
    expect(trace.events[1]!.parent_id).toBe('a');
    expect(trace.events[1]!.actor).toBe('verifier');
    expect(trace.events[1]!.type).toBe('judge.score');
  });

  it('returns trace_id="unknown" for empty transcript', () => {
    expect(toAnthropicTrace([]).trace_id).toBe('unknown');
  });
});

describe('toChromeTrace', () => {
  it('per-actor tid lane', () => {
    const t = toChromeTrace([judgeScore, qaResult]);
    expect(t.traceEvents[0]!.tid).toBe(5); // verifier
    expect(t.traceEvents[1]!.tid).toBe(8); // system
  });

  it('phase X with dur for events with latency, i for instants', () => {
    const t = toChromeTrace([judgeScore, qaResult]);
    expect(t.traceEvents[0]!.ph).toBe('X');
    expect(t.traceEvents[0]!.dur).toBe(4200 * 1000);
    expect(t.traceEvents[1]!.ph).toBe('i');
    expect(t.traceEvents[1]!.dur).toBeUndefined();
  });

  it('args carry verdict + deterministic markers', () => {
    const t = toChromeTrace([judgeScore, qaResult]);
    expect(t.traceEvents[0]!.args?.verdict).toBe('PASS');
    expect(t.traceEvents[1]!.args?.deterministic).toBe(true);
  });
});

describe('serialize', () => {
  it('otel-jsonl emits newline-delimited spans, trailing newline', () => {
    const out = serialize('otel-jsonl', [judgeScore, qaResult]);
    const lines = out.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).span_id).toBe(judgeScore.id);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('otel-jsonl empty input → empty output', () => {
    expect(serialize('otel-jsonl', [])).toBe('');
  });

  it('anthropic-trace and chrome-trace emit valid JSON objects', () => {
    expect(() => JSON.parse(serialize('anthropic-trace', [judgeScore]))).not.toThrow();
    expect(() => JSON.parse(serialize('chrome-trace', [judgeScore]))).not.toThrow();
  });
});
