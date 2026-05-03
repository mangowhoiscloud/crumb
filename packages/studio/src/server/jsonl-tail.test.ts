import { mkdtemp, writeFile, appendFile, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { JsonlTail } from './jsonl-tail.js';

async function tmpFile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'crumb-tail-'));
  return join(dir, 'transcript.jsonl');
}

describe('JsonlTail', () => {
  it('returns [] before file exists', async () => {
    const path = join(tmpdir(), 'crumb-nonexistent-' + Date.now() + '.jsonl');
    const tail = new JsonlTail(path);
    expect(await tail.pull()).toEqual([]);
  });

  it('reads only new lines on subsequent pulls', async () => {
    const path = await tmpFile();
    await writeFile(
      path,
      '{"id":"1","ts":"t","session_id":"s","from":"user","kind":"goal"}\n',
      'utf8',
    );
    const tail = new JsonlTail(path);
    expect((await tail.pull()).length).toBe(1);
    expect(await tail.pull()).toEqual([]);
    await appendFile(path, '{"id":"2","ts":"t","session_id":"s","from":"system","kind":"done"}\n');
    const second = await tail.pull();
    expect(second.length).toBe(1);
    expect(second[0]!.id).toBe('2');
  });

  it('strips CRLF line endings (Windows-written transcripts)', async () => {
    const path = await tmpFile();
    await writeFile(
      path,
      '{"id":"1","ts":"t","session_id":"s","from":"user","kind":"goal"}\r\n',
      'utf8',
    );
    const tail = new JsonlTail(path);
    const out = await tail.pull();
    expect(out.length).toBe(1);
    expect(out[0]!.id).toBe('1');
  });

  it('strips UTF-8 BOM', async () => {
    const path = await tmpFile();
    await writeFile(
      path,
      '﻿{"id":"1","ts":"t","session_id":"s","from":"user","kind":"goal"}\n',
      'utf8',
    );
    const tail = new JsonlTail(path);
    const out = await tail.pull();
    expect(out.length).toBe(1);
  });

  it('buffers a fragment until newline arrives', async () => {
    const path = await tmpFile();
    await writeFile(
      path,
      '{"id":"1","ts":"t","session_id":"s","from":"user","kind":"goal"}\n',
      'utf8',
    );
    const tail = new JsonlTail(path);
    expect((await tail.pull()).length).toBe(1);
    // append a partial line (no trailing \n)
    await appendFile(path, '{"id":"2","ts":"t","session_id":"s","from":"user","kind":"note"}');
    expect(await tail.pull()).toEqual([]);
    // complete the line
    await appendFile(path, '\n');
    const out = await tail.pull();
    expect(out.length).toBe(1);
    expect(out[0]!.id).toBe('2');
  });

  it('skips malformed lines without throwing', async () => {
    const path = await tmpFile();
    await writeFile(
      path,
      'not json\n{"id":"2","ts":"t","session_id":"s","from":"user","kind":"goal"}\n',
      'utf8',
    );
    const tail = new JsonlTail(path);
    const out = await tail.pull();
    expect(out.length).toBe(1);
    expect(out[0]!.id).toBe('2');
  });

  it('handles truncate by resetting offset to 0', async () => {
    const path = await tmpFile();
    // Original file has TWO lines (long file → small offset after truncate).
    await writeFile(
      path,
      '{"id":"1","ts":"t","session_id":"s","from":"user","kind":"goal"}\n' +
        '{"id":"2","ts":"t","session_id":"s","from":"user","kind":"note","body":"original second line"}\n',
      'utf8',
    );
    const tail = new JsonlTail(path);
    expect((await tail.pull()).length).toBe(2);
    // Truncate then write a single short line — file is now smaller than the
    // tail's offset, which must trigger reset-to-zero.
    await truncate(path, 0);
    await writeFile(
      path,
      '{"id":"99","ts":"t","session_id":"s","from":"user","kind":"goal"}\n',
      'utf8',
    );
    const out = await tail.pull();
    expect(out.length).toBe(1);
    expect(out[0]!.id).toBe('99');
  });
});
