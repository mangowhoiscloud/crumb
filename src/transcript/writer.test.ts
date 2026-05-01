import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { TranscriptWriter } from './writer.js';
import { ValidationError } from '../protocol/validate.js';

async function makeTmp(): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(resolve(tmpdir(), 'crumb-test-'));
  return { dir, path: resolve(dir, 'transcript.jsonl') };
}

describe('TranscriptWriter', () => {
  it('appends a valid message with auto-generated id + ts', async () => {
    const { path } = await makeTmp();
    const w = new TranscriptWriter({ path, sessionId: 'sess-x' });
    const msg = await w.append({
      session_id: 'sess-x',
      from: 'user',
      kind: 'goal',
      body: 'hi',
    });
    expect(msg.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(msg.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw.trim());
    expect(parsed.body).toBe('hi');
    expect(parsed.session_id).toBe('sess-x');
  });

  it('rejects schema-invalid drafts', async () => {
    const { path } = await makeTmp();
    const w = new TranscriptWriter({ path, sessionId: 'sess-x' });
    await expect(
      w.append({
        session_id: 'sess-x',
        from: 'user',
        // @ts-expect-error testing invalid kind
        kind: 'not-a-real-kind',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('serializes concurrent appends', async () => {
    const { path } = await makeTmp();
    const w = new TranscriptWriter({ path, sessionId: 'sess-x' });
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        w.append({
          session_id: 'sess-x',
          from: 'user',
          kind: 'note',
          body: `n${i}`,
        }),
      ),
    );
    const raw = await readFile(path, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(20);
    // Every line is well-formed JSON.
    for (const l of lines) JSON.parse(l);
  });
});
