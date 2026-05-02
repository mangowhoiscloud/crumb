import { describe, expect, it } from 'vitest';

import {
  makeLineSplitter,
  parseClaudeStreamProgress,
  parseCodexStreamProgress,
} from './_shared.js';

describe('makeLineSplitter', () => {
  it('yields complete lines and buffers partial trailing input', () => {
    const out: string[] = [];
    const sp = makeLineSplitter();
    sp.feed('first\nsec', (l) => out.push(l));
    expect(out).toEqual(['first']);
    sp.feed('ond\nthird', (l) => out.push(l));
    expect(out).toEqual(['first', 'second']);
    sp.flush((l) => out.push(l));
    expect(out).toEqual(['first', 'second', 'third']);
  });

  it('handles \\r\\n line endings', () => {
    const out: string[] = [];
    const sp = makeLineSplitter();
    sp.feed('alpha\r\nbeta\r\n', (l) => out.push(l));
    expect(out).toEqual(['alpha', 'beta']);
  });
});

describe('parseClaudeStreamProgress', () => {
  it('parses tool_use with file_path into a normalized event', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'Write', input: { file_path: 'artifacts/game/index.html' } },
        ],
      },
    });
    const evt = parseClaudeStreamProgress(line);
    expect(evt).toEqual({
      kind: 'tool_use',
      tool: 'Write',
      summary: 'Write artifacts/game/index.html',
      path: 'artifacts/game/index.html',
    });
  });

  it('parses thinking events', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'thinking', thinking: '...' }] },
    });
    expect(parseClaudeStreamProgress(line)?.kind).toBe('thinking');
  });

  it('parses tool_result events from user role', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'tool_result', content: 'ok' }] },
    });
    expect(parseClaudeStreamProgress(line)?.kind).toBe('tool_result');
  });

  it('returns null for system / init / non-JSON lines', () => {
    expect(parseClaudeStreamProgress('not json')).toBeNull();
    expect(
      parseClaudeStreamProgress(JSON.stringify({ type: 'system', subtype: 'init' })),
    ).toBeNull();
  });
});

describe('parseCodexStreamProgress', () => {
  it('parses tool_call with path', () => {
    const evt = parseCodexStreamProgress(
      JSON.stringify({ event: 'tool_call', name: 'apply_patch', arguments: { path: 'src/x.ts' } }),
    );
    expect(evt?.kind).toBe('tool_use');
    expect(evt?.path).toBe('src/x.ts');
    expect(evt?.tool).toBe('apply_patch');
  });

  it('parses agent_reasoning as thinking', () => {
    const evt = parseCodexStreamProgress(JSON.stringify({ event: 'agent_reasoning' }));
    expect(evt?.kind).toBe('thinking');
  });

  it('returns null for unknown event names', () => {
    expect(parseCodexStreamProgress(JSON.stringify({ event: 'session.init' }))).toBeNull();
  });
});
