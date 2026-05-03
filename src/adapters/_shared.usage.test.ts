/**
 * parseCodexStreamUsage — unit tests for the v0.5 cross-provider usage
 * extractor. The dispatcher folds adapter SpawnResult.usage into
 * agent.stop.metadata (live.ts §507-514); pre-this-PR only claude-local
 * populated usage. parseCodexStreamUsage runs over codex experimental_json
 * + gemini-cli usage_metadata blobs to recover tokens / cost / model
 * across providers — the data the studio's CostStrip + Header metrics +
 * Scorecard read.
 *
 * Heuristic (field-name walk over root + .usage / .response_usage /
 * .token_usage / .session / .usage_metadata candidate sub-objects), so
 * tests cover both codex (input_tokens / output_tokens) and gemini
 * (prompt_token_count / candidates_token_count / cached_content_token_count)
 * naming conventions, plus the OpenAI legacy shape (prompt_tokens /
 * completion_tokens).
 */

import { describe, expect, it } from 'vitest';

import { parseCodexStreamUsage } from './_shared.js';

describe('parseCodexStreamUsage', () => {
  it('returns null on empty / non-JSON / no usage-bearing input', () => {
    expect(parseCodexStreamUsage('')).toBeNull();
    expect(parseCodexStreamUsage('not json at all')).toBeNull();
    expect(parseCodexStreamUsage('{"event":"hello"}')).toBeNull();
    expect(parseCodexStreamUsage('{"input_tokens":"not a number"}')).toBeNull();
  });

  it('codex experimental_json — root-level input_tokens / output_tokens', () => {
    const stdout = `{"event":"task_complete","input_tokens":1234,"output_tokens":567,"model":"gpt-5.5-codex"}`;
    const usage = parseCodexStreamUsage(stdout);
    expect(usage).toEqual({
      tokens_in: 1234,
      tokens_out: 567,
      model: 'gpt-5.5-codex',
    });
  });

  it('codex — usage block under .usage sub-object', () => {
    const stdout = `{"event":"session_done","usage":{"input_tokens":100,"output_tokens":50,"cached_input_tokens":80}}`;
    const usage = parseCodexStreamUsage(stdout);
    expect(usage).toEqual({
      tokens_in: 100,
      tokens_out: 50,
      cache_read: 80,
    });
  });

  it('OpenAI legacy — prompt_tokens / completion_tokens names', () => {
    const stdout = `{"usage":{"prompt_tokens":900,"completion_tokens":450}}`;
    expect(parseCodexStreamUsage(stdout)).toEqual({
      tokens_in: 900,
      tokens_out: 450,
    });
  });

  it('gemini usage_metadata — prompt_token_count / candidates_token_count', () => {
    const stdout = `{"usage_metadata":{"prompt_token_count":2000,"candidates_token_count":800,"cached_content_token_count":1200}}`;
    expect(parseCodexStreamUsage(stdout)).toEqual({
      tokens_in: 2000,
      tokens_out: 800,
      cache_read: 1200,
    });
  });

  it('multi-line stdout — last occurrence wins (stream final tally)', () => {
    const stdout = [
      `{"event":"tool_call","name":"Write"}`,
      `{"event":"task_complete","input_tokens":50,"output_tokens":25}`,
      `{"event":"task_complete","input_tokens":120,"output_tokens":60}`,
    ].join('\n');
    const usage = parseCodexStreamUsage(stdout);
    expect(usage).toEqual({
      tokens_in: 120,
      tokens_out: 60,
    });
  });

  it('multi-line stdout — model stamped from any line, tokens use latest', () => {
    // The walker accumulates the latest non-undefined value for each
    // field — so a model declaration in line 1 + token totals in line 4
    // both land on the final usage object. Confirms cross-event
    // accumulation rather than naive last-line-only.
    const stdout = [
      `{"event":"thinking","model":"gpt-5"}`,
      `{"event":"task_complete","input_tokens":120,"output_tokens":60}`,
    ].join('\n');
    expect(parseCodexStreamUsage(stdout)).toEqual({
      tokens_in: 120,
      tokens_out: 60,
      model: 'gpt-5',
    });
  });

  it('non-JSON noise lines between events do not break parsing', () => {
    const stdout = [
      `[codex] booting...`,
      `(progress)`,
      `{"event":"task_complete","input_tokens":42,"output_tokens":17}`,
      `[codex] done.`,
    ].join('\n');
    expect(parseCodexStreamUsage(stdout)).toEqual({
      tokens_in: 42,
      tokens_out: 17,
    });
  });

  it('partial usage — only output tokens reported (codex thinking-only spawn)', () => {
    const stdout = `{"usage":{"output_tokens":300}}`;
    expect(parseCodexStreamUsage(stdout)).toEqual({ tokens_out: 300 });
  });

  it('model field captured even when no token counts are emitted', () => {
    // Model-only blob still returns a non-null usage so the dispatcher
    // can stamp metadata.model on agent.stop.
    const stdout = `{"usage":{"model":"gpt-5-codex"}}`;
    expect(parseCodexStreamUsage(stdout)).toEqual({ model: 'gpt-5-codex' });
  });

  it('robustness — malformed JSON line is skipped, valid line still parses', () => {
    const stdout = [
      `{"event":"broken`, // truncated, JSON.parse will throw
      `{"event":"task_complete","input_tokens":1,"output_tokens":1}`,
    ].join('\n');
    expect(parseCodexStreamUsage(stdout)).toEqual({ tokens_in: 1, tokens_out: 1 });
  });

  it('returns null when every candidate sub-object is missing the canonical fields', () => {
    const stdout = `{"event":"task_complete","extra_metadata":{"foo":"bar"}}`;
    expect(parseCodexStreamUsage(stdout)).toBeNull();
  });
});
