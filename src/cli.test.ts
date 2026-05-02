/**
 * cli.ts tests — focused on `stampEnvMetadata`, the provenance fallback that
 * fills `metadata.provider` (always) and `metadata.cross_provider` (on
 * `kind=judge.score` only) from CRUMB_PROVIDER / CRUMB_BUILDER_PROVIDER env
 * vars passed by the dispatcher.
 *
 * AGENTS.md §136 promises cross_provider gets set when verifier and builder
 * providers differ; previously only the mock adapter set it, so
 * `helpers/status.ts:144` showed "⚠ same-provider" on every real session.
 */

import { describe, expect, it } from 'vitest';

import { stampEnvMetadata } from './cli.js';
import type { DraftMessage } from './protocol/types.js';

const baseDraft = (overrides: Partial<DraftMessage> = {}): DraftMessage => ({
  session_id: '01H0000000000000000000000A',
  from: 'verifier',
  kind: 'judge.score',
  body: 'PASS 28/30',
  ...overrides,
});

describe('stampEnvMetadata', () => {
  it('stamps metadata.provider from CRUMB_PROVIDER when actor omitted it', () => {
    const out = stampEnvMetadata(baseDraft({ kind: 'note' }), { CRUMB_PROVIDER: 'anthropic' });
    expect(out.metadata?.provider).toBe('anthropic');
  });

  it('does NOT overwrite actor-supplied metadata.provider', () => {
    const out = stampEnvMetadata(baseDraft({ kind: 'note', metadata: { provider: 'openai' } }), {
      CRUMB_PROVIDER: 'anthropic',
    });
    expect(out.metadata?.provider).toBe('openai');
  });

  it('sets cross_provider=true on judge.score when providers differ', () => {
    const out = stampEnvMetadata(baseDraft(), {
      CRUMB_PROVIDER: 'google',
      CRUMB_BUILDER_PROVIDER: 'openai',
    });
    expect(out.metadata?.cross_provider).toBe(true);
    expect(out.metadata?.provider).toBe('google');
  });

  it('sets cross_provider=false on judge.score when providers match', () => {
    const out = stampEnvMetadata(baseDraft(), {
      CRUMB_PROVIDER: 'anthropic',
      CRUMB_BUILDER_PROVIDER: 'anthropic',
    });
    expect(out.metadata?.cross_provider).toBe(false);
  });

  it('does NOT stamp cross_provider on non-judge.score kinds', () => {
    const out = stampEnvMetadata(baseDraft({ kind: 'build' }), {
      CRUMB_PROVIDER: 'google',
      CRUMB_BUILDER_PROVIDER: 'openai',
    });
    expect(out.metadata?.cross_provider).toBeUndefined();
    expect(out.metadata?.provider).toBe('google');
  });

  it('skips cross_provider when builder provider is missing', () => {
    // First-build case — no prior build event → CRUMB_BUILDER_PROVIDER unset.
    const out = stampEnvMetadata(baseDraft(), { CRUMB_PROVIDER: 'google' });
    expect(out.metadata?.cross_provider).toBeUndefined();
    expect(out.metadata?.provider).toBe('google');
  });

  it('returns draft unchanged when nothing to stamp', () => {
    const draft = baseDraft({ kind: 'note', metadata: { provider: 'openai' } });
    const out = stampEnvMetadata(draft, {});
    // Identity preserved when no env-driven mutation occurs (cheap fast-path
    // for the dominant case where actors set their own metadata).
    expect(out).toBe(draft);
  });

  it('stamps harness + model from CRUMB_HARNESS / CRUMB_MODEL', () => {
    const out = stampEnvMetadata(baseDraft({ kind: 'build' }), {
      CRUMB_HARNESS: 'codex',
      CRUMB_PROVIDER: 'openai',
      CRUMB_MODEL: 'gpt-5.5-codex',
    });
    expect(out.metadata?.harness).toBe('codex');
    expect(out.metadata?.provider).toBe('openai');
    expect(out.metadata?.model).toBe('gpt-5.5-codex');
  });

  it('rejects unknown harness id (validates against the closed enum)', () => {
    const out = stampEnvMetadata(baseDraft({ kind: 'note' }), {
      CRUMB_HARNESS: 'rogue-harness',
    });
    expect(out.metadata?.harness).toBeUndefined();
  });

  it('does NOT overwrite actor-supplied harness / model', () => {
    const out = stampEnvMetadata(
      baseDraft({
        kind: 'note',
        metadata: { harness: 'gemini-cli', model: 'custom-model' },
      }),
      { CRUMB_HARNESS: 'codex', CRUMB_MODEL: 'gpt-5.5' },
    );
    expect(out.metadata?.harness).toBe('gemini-cli');
    expect(out.metadata?.model).toBe('custom-model');
  });

  it('stamps full triple harness/provider/model alongside cross_provider on judge.score', () => {
    const out = stampEnvMetadata(baseDraft(), {
      CRUMB_HARNESS: 'gemini-cli',
      CRUMB_PROVIDER: 'google',
      CRUMB_MODEL: 'gemini-3-1-pro',
      CRUMB_BUILDER_PROVIDER: 'openai',
    });
    expect(out.metadata).toMatchObject({
      harness: 'gemini-cli',
      provider: 'google',
      model: 'gemini-3-1-pro',
      cross_provider: true,
    });
  });
});
