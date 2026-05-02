import { describe, it, expect } from 'vitest';

import { parseClaudeStreamJsonUsage } from './claude-local.js';

describe('parseClaudeStreamJsonUsage', () => {
  it('returns null for empty stdout', () => {
    expect(parseClaudeStreamJsonUsage('')).toBeNull();
  });

  it('returns null when no result event is present', () => {
    const stdout =
      JSON.stringify({ type: 'system', subtype: 'init' }) +
      '\n' +
      JSON.stringify({ type: 'assistant', message: { content: [] } }) +
      '\n';
    expect(parseClaudeStreamJsonUsage(stdout)).toBeNull();
  });

  it('extracts usage + cost + model from the final result event', () => {
    const stdout =
      JSON.stringify({ type: 'assistant', message: { content: [] } }) +
      '\n' +
      JSON.stringify({
        type: 'result',
        model: 'claude-opus-4-7',
        total_cost_usd: 0.1234,
        usage: {
          input_tokens: 1500,
          output_tokens: 800,
          cache_read_input_tokens: 1200,
          cache_creation_input_tokens: 200,
        },
      }) +
      '\n';
    const usage = parseClaudeStreamJsonUsage(stdout);
    expect(usage).toEqual({
      tokens_in: 1500,
      tokens_out: 800,
      cache_read: 1200,
      cache_write: 200,
      cost_usd: 0.1234,
      model: 'claude-opus-4-7',
    });
  });

  it('skips malformed JSON lines without throwing', () => {
    const stdout =
      'not json\n' +
      JSON.stringify({
        type: 'result',
        usage: { input_tokens: 100, output_tokens: 50 },
      }) +
      '\n' +
      '{"truncated\n';
    const usage = parseClaudeStreamJsonUsage(stdout);
    expect(usage?.tokens_in).toBe(100);
    expect(usage?.tokens_out).toBe(50);
  });

  it('honors the LAST result event when multiple appear', () => {
    const stdout =
      JSON.stringify({ type: 'result', usage: { input_tokens: 1, output_tokens: 1 } }) +
      '\n' +
      JSON.stringify({
        type: 'result',
        usage: { input_tokens: 999, output_tokens: 333 },
        total_cost_usd: 0.5,
      }) +
      '\n';
    const usage = parseClaudeStreamJsonUsage(stdout);
    expect(usage?.tokens_in).toBe(999);
    expect(usage?.cost_usd).toBe(0.5);
  });
});
