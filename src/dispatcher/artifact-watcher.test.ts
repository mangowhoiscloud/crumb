import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startArtifactWatcher } from './artifact-watcher.js';
import type { Message } from '../protocol/types.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'crumb-aw-'));
  mkdirSync(join(dir, 'artifacts'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

interface CapturedDraft {
  body?: string;
  data?: { path?: string; size?: number; sha256?: string };
  kind?: string;
}

function makeWriter(captured: CapturedDraft[]) {
  return {
    append: async (draft: Partial<Message>): Promise<Message> => {
      captured.push(draft as CapturedDraft);
      return { ...(draft as Message), id: 'test', ts: new Date().toISOString() };
    },
  };
}

async function settle(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe('artifact-watcher', () => {
  it('emits artifact.created with relative path + size + sha256 when a file appears', async () => {
    const captured: CapturedDraft[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = startArtifactWatcher({
      sessionDir: dir,
      sessionId: 's1',
      writer: makeWriter(captured) as any,
    });
    await settle(150);
    writeFileSync(join(dir, 'artifacts', 'index.html'), '<html></html>');
    // chokidar awaitWriteFinish + poll: needs >300ms
    await settle(600);
    await handle.close();

    const draft = captured.find((c) => c.data?.path === 'artifacts/index.html');
    expect(draft).toBeDefined();
    expect(draft?.kind).toBe('artifact.created');
    expect(draft?.data?.size).toBe(13);
    expect(draft?.data?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('skips dotfiles', async () => {
    const captured: CapturedDraft[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = startArtifactWatcher({
      sessionDir: dir,
      sessionId: 's1',
      writer: makeWriter(captured) as any,
    });
    await settle(150);
    writeFileSync(join(dir, 'artifacts', '.DS_Store'), 'noise');
    await settle(500);
    await handle.close();
    expect(captured).toHaveLength(0);
  });
});
