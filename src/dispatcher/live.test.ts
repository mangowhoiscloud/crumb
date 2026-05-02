/**
 * Dispatcher tests — focus on v3.2 G4 sandwich override pipeline.
 *
 * Verifies that the spawn case assembles base + agents/<actor>.local.md +
 * effect.sandwich_appends into sessions/<id>/agent-workspace/<actor>/sandwich.assembled.md
 * and passes that path (not the base path) to the adapter.
 */

import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

import { dispatch, type DispatcherDeps } from './live.js';
import { TranscriptWriter } from '../transcript/writer.js';
import {
  AdapterRegistry,
  type Adapter,
  type SpawnRequest,
  type SpawnResult,
} from '../adapters/types.js';
import type { Effect } from '../effects/types.js';

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

async function makeDeps(): Promise<{
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

describe('dispatcher — v3.2 G4 sandwich override', () => {
  it('passes base sandwich path unchanged when no local + no appends', async () => {
    const { deps, capture, repoRoot } = await makeDeps();
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
    const { deps, capture, repoRoot, sessionDir } = await makeDeps();
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
    const { deps, capture, repoRoot, sessionDir } = await makeDeps();
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
    const { deps, capture, repoRoot } = await makeDeps();
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
