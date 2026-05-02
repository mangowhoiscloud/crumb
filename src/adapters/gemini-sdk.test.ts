/**
 * gemini-sdk adapter unit tests — exercise the deterministic paths that don't
 * require live SDK calls:
 *   1. health() reports missing GOOGLE_API_KEY
 *   2. text-only path (no video_refs in goal) emits step.research + handoff
 *   3. cache hit short-circuits the SDK (no network), emits note + reuses event
 *   4. invalid video_ref (neither YouTube URL nor local file) emits kind=error
 *
 * The SDK call itself (Files API + generateContent) is exercised in the
 * integration test that runs against a real GOOGLE_API_KEY (gated by env var).
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { GeminiSdkAdapter } from './gemini-sdk.js';
import type { Message } from '../protocol/types.js';

async function makeRequest(): Promise<{
  sandwichPath: string;
  transcriptPath: string;
  sessionDir: string;
}> {
  const dir = await mkdtemp(resolve(tmpdir(), 'crumb-gemini-sdk-test-'));
  const sandwichPath = resolve(dir, 'researcher.md');
  const transcriptPath = resolve(dir, 'transcript.jsonl');
  const sessionDir = resolve(dir, 'session');
  await mkdir(sessionDir, { recursive: true });
  await writeFile(sandwichPath, '# stub researcher sandwich\n');
  await writeFile(transcriptPath, '');
  return { sandwichPath, transcriptPath, sessionDir };
}

async function readEvents(path: string): Promise<Message[]> {
  const raw = await readFile(path, 'utf8');
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Message);
}

describe('GeminiSdkAdapter', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.GOOGLE_API_KEY;
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = originalKey;
  });

  it('health() reports missing GOOGLE_API_KEY', async () => {
    delete process.env.GOOGLE_API_KEY;
    const adapter = new GeminiSdkAdapter();
    const h = await adapter.health();
    expect(h.ok).toBe(false);
    expect(h.reason).toContain('GOOGLE_API_KEY');
  });

  it('v3.4: no video_refs in goal → emits kind=error (stub branch removed)', async () => {
    // v3.4: the text-only stub branch was removed because it emitted empty
    // reference_games[] / design_lessons[] regardless of input — pretending
    // to research while doing nothing. The reducer's pickAdapter('researcher')
    // now routes text-only sessions to claude-local; gemini-sdk only
    // executes when video_refs are actually present. If gemini-sdk is still
    // invoked without video_refs (e.g. user hard-bound it via .crumb/config.toml),
    // the adapter surfaces a kind=error explaining how to fix the binding.
    delete process.env.GOOGLE_API_KEY;
    const { sandwichPath, transcriptPath, sessionDir } = await makeRequest();
    const goal: Message = {
      id: '01H0000000000000000000000G',
      ts: '2026-05-02T00:00:00.000Z',
      session_id: 'sess-text-only',
      from: 'user',
      kind: 'goal',
      body: 'simple match-3 game',
    };
    await writeFile(transcriptPath, JSON.stringify(goal) + '\n');

    const adapter = new GeminiSdkAdapter();
    const result = await adapter.spawn({
      actor: 'researcher',
      sessionDir,
      sandwichPath,
      transcriptPath,
      sessionId: 'sess-text-only',
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('no video_refs');
    const events = await readEvents(transcriptPath);
    const errEvent = events.find((e) => e.kind === 'error');
    expect(errEvent).toBeDefined();
    expect(errEvent?.body).toContain('video_refs');
    expect((errEvent?.data as { reason?: string } | undefined)?.reason).toBe(
      'gemini_sdk_no_video_refs',
    );
    // No step.research / handoff emitted — the spawn surfaces the misconfig and exits.
    expect(events.find((e) => e.kind === 'step.research')).toBeUndefined();
    expect(events.find((e) => e.kind === 'handoff.requested')).toBeUndefined();
  });

  it('cache hit: matching cache_key in transcript → no SDK call, emits note', async () => {
    // Don't set GOOGLE_API_KEY — if we hit the SDK path the test will fail with
    // "missing API key" error, proving the cache short-circuit fired before SDK load.
    delete process.env.GOOGLE_API_KEY;
    const { sandwichPath, transcriptPath, sessionDir } = await makeRequest();

    const videoRef = 'https://youtu.be/test123';
    const goal: Message = {
      id: '01H0000000000000000000000G',
      ts: '2026-05-02T00:00:00.000Z',
      session_id: 'sess-cache-hit',
      from: 'user',
      kind: 'goal',
      body: 'with video',
      data: { video_refs: [videoRef] },
    };
    // Pre-seed a step.research.video event with the matching cache_key.
    // Cache key formula must match adapter's: sha256(uri::model::PROMPT_VERSION).
    const { createHash } = await import('node:crypto');
    const cacheKey = createHash('sha256')
      .update(`${videoRef}::gemini-3-1-pro::v3.3-researcher@v1`)
      .digest('hex');
    const cachedEvidence: Message = {
      id: '01H0000000000000000000001V',
      ts: '2026-05-02T00:01:00.000Z',
      session_id: 'sess-cache-hit',
      from: 'researcher',
      kind: 'step.research.video',
      body: 'cached evidence',
      metadata: {
        cache_key: cacheKey,
        evidence_kind: 'video',
        deterministic: false,
      },
    };
    await writeFile(
      transcriptPath,
      [JSON.stringify(goal), JSON.stringify(cachedEvidence)].join('\n') + '\n',
    );

    const adapter = new GeminiSdkAdapter();
    const result = await adapter.spawn({
      actor: 'researcher',
      sessionDir,
      sandwichPath,
      transcriptPath,
      sessionId: 'sess-cache-hit',
    });

    expect(result.exitCode).toBe(0);
    const events = await readEvents(transcriptPath);
    const cacheNote = events.find((e) => e.kind === 'note' && e.body?.includes('cache hit'));
    expect(cacheNote).toBeDefined();
    // No new step.research.video should be appended (cache hit reuses the existing one).
    const videoEvents = events.filter((e) => e.kind === 'step.research.video');
    expect(videoEvents).toHaveLength(1);
    expect(videoEvents[0]?.id).toBe('01H0000000000000000000001V');
  });

  it('invalid video_ref → emits kind=error and continues', async () => {
    delete process.env.GOOGLE_API_KEY;
    const { sandwichPath, transcriptPath, sessionDir } = await makeRequest();

    const goal: Message = {
      id: '01H0000000000000000000000G',
      ts: '2026-05-02T00:00:00.000Z',
      session_id: 'sess-bad-ref',
      from: 'user',
      kind: 'goal',
      body: 'with bad ref',
      data: { video_refs: ['ftp://not-allowed/clip.mp4'] },
    };
    await writeFile(transcriptPath, JSON.stringify(goal) + '\n');

    const adapter = new GeminiSdkAdapter();
    const result = await adapter.spawn({
      actor: 'researcher',
      sessionDir,
      sandwichPath,
      transcriptPath,
      sessionId: 'sess-bad-ref',
    });

    // Adapter still tries to load SDK after bad refs (cache miss path), and
    // SDK loading fails because GOOGLE_API_KEY is unset → exitCode=2.
    // The error event for the invalid ref must still be present.
    expect([0, 2]).toContain(result.exitCode);
    const events = await readEvents(transcriptPath);
    const err = events.find((e) => e.kind === 'error' && e.body?.includes('invalid video_ref'));
    expect(err).toBeDefined();
  });
});
