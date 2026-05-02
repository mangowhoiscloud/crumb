/**
 * Dispatcher tests — two coupled focuses:
 *
 *   1. v3.2 G4 sandwich override pipeline. Verifies the spawn case assembles
 *      base + agents/<actor>.local.md + effect.sandwich_appends into
 *      sessions/<id>/agent-workspace/<actor>/sandwich.assembled.md and passes
 *      that path (not the base path) to the adapter.
 *
 *   2. v3.2 per_spawn_timeout guardrail. Stub adapters cover (a) fast adapter
 *      under budget, (b) hanging adapter ignoring abort (timeout fires but
 *      adapter still returns; dispatcher records timeout in transcript), and
 *      (c) cooperative hanging adapter exiting 124 on signal (matches live
 *      adapters wired to child.kill('SIGTERM')).
 */

import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

import { dispatch, parseInlineRefs, type DispatcherDeps } from './live.js';
import { TranscriptWriter } from '../transcript/writer.js';
import {
  AdapterRegistry,
  type Adapter,
  type SpawnRequest,
  type SpawnResult,
} from '../adapters/types.js';
import type { Effect } from '../effects/types.js';
import type { Message } from '../protocol/types.js';

class CaptureAdapter implements Adapter {
  readonly id = 'capture';
  lastRequest: SpawnRequest | null = null;
  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    this.lastRequest = req;
    return { exitCode: 0, stdout: '', stderr: '', durationMs: 1 };
  }
}

async function makeSandwichDeps(): Promise<{
  deps: DispatcherDeps;
  capture: CaptureAdapter;
  repoRoot: string;
  sessionDir: string;
}> {
  const repoRoot = await mkdtemp(resolve(tmpdir(), 'crumb-disp-repo-'));
  const sessionDir = await mkdtemp(resolve(tmpdir(), 'crumb-disp-sess-'));
  await mkdir(resolve(repoRoot, 'agents'), { recursive: true });
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  await writeFile(transcriptPath, '');
  const writer = new TranscriptWriter({
    path: transcriptPath,
    sessionId: 'sess-disp-test',
  });
  const registry = new AdapterRegistry();
  const capture = new CaptureAdapter();
  registry.register(capture);
  const deps: DispatcherDeps = {
    writer,
    registry,
    sessionId: 'sess-disp-test',
    sessionDir,
    transcriptPath,
    repoRoot,
  };
  return { deps, capture, repoRoot, sessionDir };
}

class FastAdapter implements Adapter {
  readonly id = 'stub-fast';
  spawnCount = 0;
  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
  async spawn(): Promise<SpawnResult> {
    this.spawnCount += 1;
    return { exitCode: 0, stdout: 'fast', stderr: '', durationMs: 1 };
  }
}

class HangingIgnoresSignal implements Adapter {
  readonly id = 'stub-hang-ignore';
  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
  async spawn(_req: SpawnRequest): Promise<SpawnResult> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 200));
    return { exitCode: 0, stdout: '', stderr: '', durationMs: Date.now() - start };
  }
}

class HangingCooperative implements Adapter {
  readonly id = 'stub-hang-coop';
  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    return new Promise<SpawnResult>((resolveResult) => {
      const start = Date.now();
      const finish = (exitCode: number, stderr: string): void => {
        resolveResult({ exitCode, stdout: '', stderr, durationMs: Date.now() - start });
      };
      const timer = setTimeout(() => finish(0, ''), 5000);
      timer.unref?.();
      req.signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          finish(124, 'aborted by signal');
        },
        { once: true },
      );
    });
  }
}

async function readEvents(path: string): Promise<Message[]> {
  const raw = await readFile(path, 'utf8');
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Message);
}

async function makeTimeoutDeps(
  adapter: Adapter,
  perSpawnTimeoutMs: number,
): Promise<DispatcherDeps> {
  const dir = await mkdtemp(resolve(tmpdir(), 'crumb-dispatch-test-'));
  const sessionDir = resolve(dir, 'session');
  await mkdir(sessionDir, { recursive: true });
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  await writeFile(transcriptPath, '');
  const writer = new TranscriptWriter({ path: transcriptPath, sessionId: 'sess-test' });
  const registry = new AdapterRegistry();
  registry.register(adapter);
  const repoRoot = resolve(dir, 'repo');
  await mkdir(resolve(repoRoot, 'agents'), { recursive: true });
  await writeFile(resolve(repoRoot, 'agents', 'builder.md'), '# stub builder sandwich\n');
  return {
    writer,
    registry,
    sessionId: 'sess-test',
    sessionDir,
    transcriptPath,
    repoRoot,
    perSpawnTimeoutMs,
  };
}

const spawnEffect: Effect = {
  type: 'spawn',
  actor: 'builder',
  adapter: '',
};

describe('dispatcher — v3.2 G4 sandwich override', () => {
  it('passes base sandwich path unchanged when no local + no appends', async () => {
    const { deps, capture, repoRoot } = await makeSandwichDeps();
    const basePath = resolve(repoRoot, 'agents/builder.md');
    await writeFile(basePath, '# base builder sandwich\n');
    const eff: Effect = {
      type: 'spawn',
      actor: 'builder',
      adapter: 'capture',
      sandwich_appends: [],
    };
    await dispatch(eff, deps);
    expect(capture.lastRequest?.sandwichPath).toBe(basePath);
  });

  it('assembles base + appends into sessions/<id>/agent-workspace/<actor>/sandwich.assembled.md', async () => {
    const { deps, capture, repoRoot, sessionDir } = await makeSandwichDeps();
    const basePath = resolve(repoRoot, 'agents/builder.md');
    await writeFile(basePath, '# base builder sandwich\n');
    const eff: Effect = {
      type: 'spawn',
      actor: 'builder',
      adapter: 'capture',
      sandwich_appends: [
        { source_id: '01H0000000000000000000001A', text: 'rule one' },
        { source_id: '01H0000000000000000000002A', text: 'rule two' },
      ],
    };
    await dispatch(eff, deps);
    const expected = resolve(sessionDir, 'agent-workspace', 'builder', 'sandwich.assembled.md');
    expect(capture.lastRequest?.sandwichPath).toBe(expected);
    const assembled = await readFile(expected, 'utf-8');
    expect(assembled).toContain('# base builder sandwich');
    expect(assembled).toContain('rule one');
    expect(assembled).toContain('rule two');
    expect(assembled).toContain('source=01H0000000000000000000001A');
  });

  it('includes agents/<actor>.local.md when present', async () => {
    const { deps, capture, repoRoot, sessionDir } = await makeSandwichDeps();
    const basePath = resolve(repoRoot, 'agents/builder.md');
    const localPath = resolve(repoRoot, 'agents/builder.local.md');
    await writeFile(basePath, '# base builder sandwich\n');
    await writeFile(localPath, '# local override — phaser 4 forbidden\n');
    const eff: Effect = {
      type: 'spawn',
      actor: 'builder',
      adapter: 'capture',
      sandwich_appends: [],
    };
    await dispatch(eff, deps);
    const expected = resolve(sessionDir, 'agent-workspace', 'builder', 'sandwich.assembled.md');
    expect(capture.lastRequest?.sandwichPath).toBe(expected);
    const assembled = await readFile(expected, 'utf-8');
    expect(assembled).toContain('# base builder sandwich');
    expect(assembled).toContain('phaser 4 forbidden');
    expect(assembled).toContain(`begin local override (${localPath})`);
  });

  it('orders parts: base → local → appends', async () => {
    const { deps, capture, repoRoot } = await makeSandwichDeps();
    const basePath = resolve(repoRoot, 'agents/builder.md');
    const localPath = resolve(repoRoot, 'agents/builder.local.md');
    await writeFile(basePath, 'BASE_MARKER');
    await writeFile(localPath, 'LOCAL_MARKER');
    const eff: Effect = {
      type: 'spawn',
      actor: 'builder',
      adapter: 'capture',
      sandwich_appends: [{ source_id: '01H0000000000000000000003A', text: 'APPEND_MARKER' }],
    };
    await dispatch(eff, deps);
    const assembled = await readFile(capture.lastRequest!.sandwichPath, 'utf-8');
    const baseIdx = assembled.indexOf('BASE_MARKER');
    const localIdx = assembled.indexOf('LOCAL_MARKER');
    const appendIdx = assembled.indexOf('APPEND_MARKER');
    expect(baseIdx).toBeGreaterThanOrEqual(0);
    expect(localIdx).toBeGreaterThan(baseIdx);
    expect(appendIdx).toBeGreaterThan(localIdx);
    expect(basename(capture.lastRequest!.sandwichPath)).toBe('sandwich.assembled.md');
    expect(existsSync(capture.lastRequest!.sandwichPath)).toBe(true);
  });
});

describe('dispatcher usage forwarding', () => {
  class UsageAdapter implements Adapter {
    readonly id = 'stub-usage';
    async health(): Promise<{ ok: boolean }> {
      return { ok: true };
    }
    async spawn(): Promise<SpawnResult> {
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 42,
        usage: {
          tokens_in: 1500,
          tokens_out: 800,
          cache_read: 1200,
          cache_write: 200,
          cost_usd: 0.0123,
          model: 'claude-opus-4-7',
        },
      };
    }
  }

  it('folds adapter SpawnResult.usage into agent.stop metadata', async () => {
    const adapter = new UsageAdapter();
    const deps = await makeTimeoutDeps(adapter, 1000);
    await dispatch({ ...spawnEffect, adapter: adapter.id }, deps);

    const events = await readEvents(deps.transcriptPath);
    const stop = events.find((e) => e.kind === 'agent.stop');
    expect(stop).toBeDefined();
    expect(stop?.metadata).toMatchObject({
      latency_ms: 42,
      tokens_in: 1500,
      tokens_out: 800,
      cache_read: 1200,
      cache_write: 200,
      cost_usd: 0.0123,
      model: 'claude-opus-4-7',
    });
  });

  it('omits token fields when adapter does not surface usage', async () => {
    const adapter = new FastAdapter();
    const deps = await makeTimeoutDeps(adapter, 1000);
    await dispatch({ ...spawnEffect, adapter: adapter.id }, deps);

    const events = await readEvents(deps.transcriptPath);
    const stop = events.find((e) => e.kind === 'agent.stop');
    expect(stop?.metadata?.latency_ms).toBeDefined();
    expect(stop?.metadata?.tokens_in).toBeUndefined();
    expect(stop?.metadata?.cost_usd).toBeUndefined();
  });
});

describe('dispatcher — G-C length bias firewall (verifier-only)', () => {
  it('injects artifact length context into verifier sandwich when artifacts exist', async () => {
    const { deps, capture, repoRoot, sessionDir } = await makeSandwichDeps();
    await writeFile(resolve(repoRoot, 'agents/verifier.md'), '# verifier base\n');
    const artifactsDir = resolve(sessionDir, 'artifacts');
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(resolve(artifactsDir, 'spec.md'), '# spec\n'.repeat(50));
    await writeFile(resolve(artifactsDir, 'game.html'), '<html>'.repeat(200));
    const eff: Effect = { type: 'spawn', actor: 'verifier', adapter: 'capture' };
    await dispatch(eff, deps);
    const assembled = await readFile(capture.lastRequest!.sandwichPath, 'utf-8');
    expect(assembled).toContain('# verifier base');
    expect(assembled).toContain('Artifact length context');
    expect(assembled).toContain('spec.md:');
    expect(assembled).toContain('game.html:');
    expect(assembled).toContain('source=system:length-context@v1');
    // Reminds the judge not to use length as a quality signal
    expect(assembled).toContain('length is not quality');
  });

  it('does NOT inject length context for builder spawns (D2/D6 immune per Rubric-Anchored Judging NeurIPS 2025)', async () => {
    const { deps, capture, repoRoot, sessionDir } = await makeSandwichDeps();
    await writeFile(resolve(repoRoot, 'agents/builder.md'), '# builder base\n');
    const artifactsDir = resolve(sessionDir, 'artifacts');
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(resolve(artifactsDir, 'spec.md'), '# spec\n');
    const eff: Effect = { type: 'spawn', actor: 'builder', adapter: 'capture' };
    await dispatch(eff, deps);
    // Builder gets the base sandwich path unchanged (no length context to inject).
    expect(capture.lastRequest!.sandwichPath).toBe(resolve(repoRoot, 'agents/builder.md'));
  });

  it('verifier without artifacts emits no length context (graceful no-op)', async () => {
    const { deps, capture, repoRoot } = await makeSandwichDeps();
    await writeFile(resolve(repoRoot, 'agents/verifier.md'), '# verifier base\n');
    // No artifacts dir → length context list is empty → assembleSandwich's
    // additive-only fast path returns the base sandwich path.
    const eff: Effect = { type: 'spawn', actor: 'verifier', adapter: 'capture' };
    await dispatch(eff, deps);
    expect(capture.lastRequest!.sandwichPath).toBe(resolve(repoRoot, 'agents/verifier.md'));
  });

  it('reports byte + token counts for present artifacts only', async () => {
    const { deps, capture, repoRoot, sessionDir } = await makeSandwichDeps();
    await writeFile(resolve(repoRoot, 'agents/verifier.md'), '# verifier base\n');
    const artifactsDir = resolve(sessionDir, 'artifacts');
    await mkdir(artifactsDir, { recursive: true });
    // Only spec.md exists; DESIGN.md / tuning.json / game.html absent
    await writeFile(resolve(artifactsDir, 'spec.md'), 'x'.repeat(800));
    const eff: Effect = { type: 'spawn', actor: 'verifier', adapter: 'capture' };
    await dispatch(eff, deps);
    const assembled = await readFile(capture.lastRequest!.sandwichPath, 'utf-8');
    expect(assembled).toContain('spec.md: 800B (~200 tokens)');
    expect(assembled).not.toContain('DESIGN.md:');
    expect(assembled).not.toContain('game.html:');
  });

  it('length context appends BEFORE user-supplied sandwich_appends so user notes win', async () => {
    const { deps, capture, repoRoot, sessionDir } = await makeSandwichDeps();
    await writeFile(resolve(repoRoot, 'agents/verifier.md'), '# verifier base\n');
    const artifactsDir = resolve(sessionDir, 'artifacts');
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(resolve(artifactsDir, 'spec.md'), 'x');
    const eff: Effect = {
      type: 'spawn',
      actor: 'verifier',
      adapter: 'capture',
      sandwich_appends: [{ source_id: '01H0000000000USERNOTE', text: 'USER_NOTE_LAST' }],
    };
    await dispatch(eff, deps);
    const assembled = await readFile(capture.lastRequest!.sandwichPath, 'utf-8');
    const lengthIdx = assembled.indexOf('Artifact length context');
    const userIdx = assembled.indexOf('USER_NOTE_LAST');
    expect(lengthIdx).toBeGreaterThan(0);
    expect(userIdx).toBeGreaterThan(lengthIdx);
  });
});

describe('dispatcher per_spawn_timeout', () => {
  it('fast spawn completes without recording an error', async () => {
    const adapter = new FastAdapter();
    const deps = await makeTimeoutDeps(adapter, 1000);
    await dispatch({ ...spawnEffect, adapter: adapter.id }, deps);

    const events = await readEvents(deps.transcriptPath);
    expect(adapter.spawnCount).toBe(1);
    expect(events.some((e) => e.kind === 'error')).toBe(false);
    const stop = events.find((e) => e.kind === 'agent.stop');
    expect(stop).toBeDefined();
    expect(stop?.body).not.toMatch(/timed out/);
  }, 5_000);

  it('records per_spawn_timeout error when adapter ignores the abort signal', async () => {
    const adapter = new HangingIgnoresSignal();
    const deps = await makeTimeoutDeps(adapter, 50);
    await dispatch({ ...spawnEffect, adapter: adapter.id }, deps);

    const events = await readEvents(deps.transcriptPath);
    const err = events.find((e) => e.kind === 'error');
    expect(err).toBeDefined();
    expect(err?.body).toMatch(/per_spawn_timeout/);
    expect(err?.data).toMatchObject({ reason: 'per_spawn_timeout', timeout_ms: 50 });
    const stop = events.find((e) => e.kind === 'agent.stop');
    expect(stop?.body).toMatch(/timed out/);
  }, 5_000);

  it('cooperative adapter exits early on abort and dispatcher records timeout', async () => {
    const adapter = new HangingCooperative();
    const deps = await makeTimeoutDeps(adapter, 50);
    const t0 = Date.now();
    await dispatch({ ...spawnEffect, adapter: adapter.id }, deps);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2000);

    const events = await readEvents(deps.transcriptPath);
    const err = events.find((e) => e.kind === 'error');
    expect(err).toBeDefined();
    expect(err?.body).toMatch(/per_spawn_timeout/);
    expect(err?.data).toMatchObject({
      reason: 'per_spawn_timeout',
      timeout_ms: 50,
      exit_code: 124,
    });
  }, 5_000);
});

describe('parseInlineRefs', () => {
  it('extracts inline_skills + inline_specialists from frontmatter', () => {
    const md = [
      '---',
      'name: planner-lead',
      'inline_skills:',
      '  - skills/parallel-dispatch.md',
      'inline_specialists:',
      '  - agents/specialists/concept-designer.md',
      '  - agents/specialists/visual-designer.md',
      '  - agents/specialists/game-design.md',
      '---',
      '',
      '# body',
    ].join('\n');
    const { skills, specialists } = parseInlineRefs(md);
    expect(skills).toEqual(['skills/parallel-dispatch.md']);
    expect(specialists).toEqual([
      'agents/specialists/concept-designer.md',
      'agents/specialists/visual-designer.md',
      'agents/specialists/game-design.md',
    ]);
  });

  it('returns empty when no frontmatter', () => {
    expect(parseInlineRefs('# just a heading\n')).toEqual({ skills: [], specialists: [] });
  });

  it('returns empty when frontmatter unterminated', () => {
    expect(parseInlineRefs('---\nname: x\ninline_skills:\n  - a.md\n')).toEqual({
      skills: [],
      specialists: [],
    });
  });

  it('stops list parsing at the next non-list line', () => {
    const md = [
      '---',
      'name: x',
      'inline_skills:',
      '  - skills/a.md',
      '  - skills/b.md',
      'activation_condition: |',
      '  some block',
      '---',
    ].join('\n');
    const { skills } = parseInlineRefs(md);
    expect(skills).toEqual(['skills/a.md', 'skills/b.md']);
  });
});

describe('dispatcher — inline-read assembler (v3.4)', () => {
  it('embeds files declared in inline_skills + inline_specialists', async () => {
    const { deps, capture, repoRoot } = await makeSandwichDeps();
    await mkdir(resolve(repoRoot, 'agents/specialists'), { recursive: true });
    await mkdir(resolve(repoRoot, 'skills'), { recursive: true });
    await writeFile(
      resolve(repoRoot, 'agents/builder.md'),
      [
        '---',
        'name: builder',
        'inline_skills:',
        '  - skills/tdd-iron-law.md',
        'inline_specialists:',
        '  - agents/specialists/game-design.md',
        '---',
        '',
        '# Builder',
      ].join('\n'),
    );
    await writeFile(resolve(repoRoot, 'skills/tdd-iron-law.md'), 'TDD_IRON_LAW_BODY');
    await writeFile(
      resolve(repoRoot, 'agents/specialists/game-design.md'),
      'GAME_DESIGN_CONTRACT_BODY',
    );
    const eff: Effect = { type: 'spawn', actor: 'builder', adapter: 'capture' };
    await dispatch(eff, deps);
    const assembled = await readFile(capture.lastRequest!.sandwichPath, 'utf-8');
    expect(assembled).toContain('TDD_IRON_LAW_BODY');
    expect(assembled).toContain('GAME_DESIGN_CONTRACT_BODY');
    expect(assembled).toContain('begin inlined skill (skills/tdd-iron-law.md)');
    expect(assembled).toContain('begin inlined specialist (agents/specialists/game-design.md)');
  });

  it('emits a MISSING marker when a declared inline file is absent', async () => {
    const { deps, capture, repoRoot } = await makeSandwichDeps();
    await writeFile(
      resolve(repoRoot, 'agents/builder.md'),
      [
        '---',
        'name: builder',
        'inline_specialists:',
        '  - agents/specialists/does-not-exist.md',
        '---',
        '',
        '# Builder',
      ].join('\n'),
    );
    const eff: Effect = { type: 'spawn', actor: 'builder', adapter: 'capture' };
    await dispatch(eff, deps);
    const assembled = await readFile(capture.lastRequest!.sandwichPath, 'utf-8');
    expect(assembled).toContain('inline specialist MISSING: agents/specialists/does-not-exist.md');
  });

  it('places inlined refs after base but before event-protocol', async () => {
    const { deps, capture, repoRoot } = await makeSandwichDeps();
    await mkdir(resolve(repoRoot, 'skills'), { recursive: true });
    await writeFile(resolve(repoRoot, 'agents/_event-protocol.md'), 'EVENT_PROTOCOL_BODY');
    await writeFile(
      resolve(repoRoot, 'agents/builder.md'),
      [
        '---',
        'name: builder',
        'inline_skills:',
        '  - skills/tdd-iron-law.md',
        '---',
        '',
        'BASE_MARKER',
      ].join('\n'),
    );
    await writeFile(resolve(repoRoot, 'skills/tdd-iron-law.md'), 'SKILL_MARKER');
    const eff: Effect = { type: 'spawn', actor: 'builder', adapter: 'capture' };
    await dispatch(eff, deps);
    const assembled = await readFile(capture.lastRequest!.sandwichPath, 'utf-8');
    const baseIdx = assembled.indexOf('BASE_MARKER');
    const skillIdx = assembled.indexOf('SKILL_MARKER');
    const protoIdx = assembled.indexOf('EVENT_PROTOCOL_BODY');
    expect(baseIdx).toBeGreaterThanOrEqual(0);
    expect(skillIdx).toBeGreaterThan(baseIdx);
    expect(protoIdx).toBeGreaterThan(skillIdx);
  });
});

describe('dispatcher idle-timeout (v3.4)', () => {
  class SilentHangAdapter implements Adapter {
    readonly id = 'silent-hang';
    async health(): Promise<{ ok: boolean }> {
      return { ok: true };
    }
    async spawn(req: SpawnRequest): Promise<SpawnResult> {
      return new Promise<SpawnResult>((resolveResult) => {
        const start = Date.now();
        const finish = (exitCode: number, stderr: string): void => {
          resolveResult({ exitCode, stdout: '', stderr, durationMs: Date.now() - start });
        };
        const timer = setTimeout(() => finish(0, ''), 5000);
        timer.unref?.();
        req.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            finish(124, 'aborted');
          },
          { once: true },
        );
      });
    }
  }

  class ChattyHangAdapter implements Adapter {
    readonly id = 'chatty-hang';
    async health(): Promise<{ ok: boolean }> {
      return { ok: true };
    }
    async spawn(req: SpawnRequest): Promise<SpawnResult> {
      return new Promise<SpawnResult>((resolveResult) => {
        const start = Date.now();
        const ping = setInterval(() => req.onStdoutActivity?.(), 30);
        ping.unref?.();
        const finish = (exitCode: number, stderr: string): void => {
          clearInterval(ping);
          resolveResult({ exitCode, stdout: '', stderr, durationMs: Date.now() - start });
        };
        const wallTimer = setTimeout(() => finish(0, ''), 5000);
        wallTimer.unref?.();
        req.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(wallTimer);
            finish(124, 'aborted');
          },
          { once: true },
        );
      });
    }
  }

  async function makeIdleDeps(
    adapter: Adapter,
    perSpawnTimeoutMs: number,
    perSpawnIdleTimeoutMs: number,
  ): Promise<DispatcherDeps> {
    const dir = await mkdtemp(resolve(tmpdir(), 'crumb-dispatch-idle-'));
    const sessionDir = resolve(dir, 'session');
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
    await writeFile(transcriptPath, '');
    const writer = new TranscriptWriter({ path: transcriptPath, sessionId: 'sess-idle' });
    const registry = new AdapterRegistry();
    registry.register(adapter);
    const repoRoot = resolve(dir, 'repo');
    await mkdir(resolve(repoRoot, 'agents'), { recursive: true });
    await writeFile(resolve(repoRoot, 'agents', 'builder.md'), '# stub\n');
    return {
      writer,
      registry,
      sessionId: 'sess-idle',
      sessionDir,
      transcriptPath,
      repoRoot,
      perSpawnTimeoutMs,
      perSpawnIdleTimeoutMs,
    };
  }

  it('idle-timeout fires when adapter is silent past idle budget', async () => {
    const adapter = new SilentHangAdapter();
    const deps = await makeIdleDeps(adapter, 5000, 100);
    const t0 = Date.now();
    await dispatch({ ...spawnEffect, adapter: adapter.id }, deps);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2000);
    const events = await readEvents(deps.transcriptPath);
    const err = events.find((e) => e.kind === 'error');
    expect(err?.data).toMatchObject({
      reason: 'per_spawn_timeout',
      timeout_kind: 'idle',
      timeout_ms: 100,
    });
    expect(err?.body).toMatch(/silent for 100ms/);
  }, 5_000);

  it('idle-timeout does NOT fire while adapter pings stdout activity', async () => {
    const adapter = new ChattyHangAdapter();
    const deps = await makeIdleDeps(adapter, 200, 100);
    const t0 = Date.now();
    await dispatch({ ...spawnEffect, adapter: adapter.id }, deps);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2000);
    const events = await readEvents(deps.transcriptPath);
    const err = events.find((e) => e.kind === 'error');
    // wall-clock fires before idle because activity keeps idle reset
    expect(err?.data).toMatchObject({
      reason: 'per_spawn_timeout',
      timeout_kind: 'wall_clock',
      timeout_ms: 200,
    });
  }, 5_000);
});
