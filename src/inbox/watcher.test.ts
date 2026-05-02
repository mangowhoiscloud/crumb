import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { TranscriptWriter } from '../transcript/writer.js';
import { startInboxWatcher } from './watcher.js';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('inbox watcher', () => {
  it('appends each new line as a transcript event', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crumb-inbox-'));
    const inboxPath = join(dir, 'inbox.txt');
    const transcriptPath = join(dir, 'transcript.jsonl');
    writeFileSync(inboxPath, '');
    writeFileSync(transcriptPath, '');

    const writer = new TranscriptWriter({ path: transcriptPath, sessionId: 'sess-watcher' });
    const handle = startInboxWatcher({
      inboxPath,
      sessionId: 'sess-watcher',
      writer,
      pollIntervalMs: 50,
    });

    // Append two lines mid-session
    appendFileSync(inboxPath, '/pause @builder waiting\n');
    appendFileSync(inboxPath, '@planner-lead 콤보 짧게\n');
    await sleep(200);
    handle.stop();

    const lines = readFileSync(transcriptPath, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      from: 'user',
      kind: 'user.pause',
      body: 'waiting',
      data: { actor: 'builder' },
    });
    expect(lines[1]).toMatchObject({
      from: 'user',
      kind: 'user.intervene',
      body: '콤보 짧게',
      data: { target_actor: 'planner-lead' },
    });
  });

  it('ignores blank and comment lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crumb-inbox-'));
    const inboxPath = join(dir, 'inbox.txt');
    const transcriptPath = join(dir, 'transcript.jsonl');
    writeFileSync(inboxPath, '');
    writeFileSync(transcriptPath, '');

    const writer = new TranscriptWriter({ path: transcriptPath, sessionId: 'sess-watcher' });
    const handle = startInboxWatcher({
      inboxPath,
      sessionId: 'sess-watcher',
      writer,
      pollIntervalMs: 50,
    });

    appendFileSync(inboxPath, '\n# comment line\n   \n/approve\n');
    await sleep(200);
    handle.stop();

    const lines = readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ kind: 'user.approve' });
  });

  it('handles incremental writes (line not yet terminated)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crumb-inbox-'));
    const inboxPath = join(dir, 'inbox.txt');
    const transcriptPath = join(dir, 'transcript.jsonl');
    writeFileSync(inboxPath, '');
    writeFileSync(transcriptPath, '');

    const writer = new TranscriptWriter({ path: transcriptPath, sessionId: 'sess-watcher' });
    const handle = startInboxWatcher({
      inboxPath,
      sessionId: 'sess-watcher',
      writer,
      pollIntervalMs: 30,
    });

    // Write "/pause" without trailing newline first; should NOT emit yet.
    appendFileSync(inboxPath, '/pause');
    await sleep(80);
    let lineCount = readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean).length;
    expect(lineCount).toBe(0);

    // Now terminate it — should emit.
    appendFileSync(inboxPath, '\n');
    await sleep(120);
    lineCount = readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean).length;
    expect(lineCount).toBe(1);

    handle.stop();
  });
});
