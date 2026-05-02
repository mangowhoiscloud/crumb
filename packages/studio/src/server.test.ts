/**
 * SSE server smoke test. Starts a real HTTP server on port 0, hits each endpoint.
 */

import { mkdtemp, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix, sep } from 'node:path';

import { describe, it, expect } from 'vitest';

import { startStudioServer } from './server.js';

async function fetchText(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url);
  return { status: res.status, body: await res.text() };
}

// node:fetch is experimental on Node 18 (slow startup; CI hits 5 s timeout).
// Skip the SSE smoke specs there — Node 20 / 22 still cover them.
const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const describeServer = NODE_MAJOR >= 20 ? describe : describe.skip;

describeServer('studio server', () => {
  it('serves studio HTML at /', async () => {
    const home = await mkdtemp(join(tmpdir(), 'crumb-dash-'));
    process.env.CRUMB_HOME = home;
    const glob = posix.join(
      home.split(sep).join('/'),
      'projects',
      '*',
      'sessions',
      '*',
      'transcript.jsonl',
    );
    const server = await startStudioServer({ port: 0, bind: '127.0.0.1', glob });
    try {
      const r = await fetchText(server.url);
      expect(r.status).toBe(200);
      expect(r.body).toMatch(/<!DOCTYPE html>/);
      expect(r.body).toContain('Crumb · Live Studio');
    } finally {
      await server.close();
    }
  });

  it('serves /api/sessions JSON', async () => {
    const home = await mkdtemp(join(tmpdir(), 'crumb-dash-'));
    const sessionDir = join(home, 'projects', 'p1', 'sessions', 'sess-A');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, 'transcript.jsonl'),
      JSON.stringify({
        id: '1',
        ts: '2026-05-02T00:00:00.000Z',
        session_id: 'sess-A',
        from: 'user',
        kind: 'goal',
        body: 'hi',
      }) + '\n',
      'utf8',
    );
    const glob = posix.join(
      home.split(sep).join('/'),
      'projects',
      '*',
      'sessions',
      '*',
      'transcript.jsonl',
    );
    const server = await startStudioServer({ port: 0, bind: '127.0.0.1', glob });
    try {
      // Allow chokidar's initial 'add' event to flush.
      await new Promise((r) => setTimeout(r, 200));
      const r = await fetch(server.url + 'api/sessions');
      const json = (await r.json()) as {
        sessions: Array<{ session_id: string; goal: string | null }>;
      };
      expect(json.sessions.some((s) => s.session_id === 'sess-A' && s.goal === 'hi')).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('streams append events via SSE', async () => {
    const home = await mkdtemp(join(tmpdir(), 'crumb-dash-'));
    const sessionDir = join(home, 'projects', 'p1', 'sessions', 'sess-B');
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'transcript.jsonl');
    await writeFile(transcriptPath, '', 'utf8');
    const glob = posix.join(
      home.split(sep).join('/'),
      'projects',
      '*',
      'sessions',
      '*',
      'transcript.jsonl',
    );
    const server = await startStudioServer({
      port: 0,
      bind: '127.0.0.1',
      glob,
      pollInterval: 50,
    });

    try {
      await new Promise((r) => setTimeout(r, 100));
      const controller = new AbortController();
      const ssePromise = (async () => {
        const res = await fetch(server.url + 'api/stream?session=*', { signal: controller.signal });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        const events: string[] = [];
        const start = Date.now();
        while (Date.now() - start < 3000) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          if (buf.includes('event: append')) {
            events.push('append');
            break;
          }
        }
        controller.abort();
        return events;
      })();

      // Wait briefly so SSE handshake completes, then append a line.
      await new Promise((r) => setTimeout(r, 200));
      await appendFile(
        transcriptPath,
        JSON.stringify({
          id: '1',
          ts: '2026-05-02T00:00:00.000Z',
          session_id: 'sess-B',
          from: 'user',
          kind: 'goal',
          body: 'hi',
        }) + '\n',
      );
      const events = await ssePromise;
      expect(events).toContain('append');
    } finally {
      await server.close();
    }
  });

  it('serves /api/sessions/:id/sandwich/:actor when assembled file exists', async () => {
    const home = await mkdtemp(join(tmpdir(), 'crumb-dash-'));
    const sessionDir = join(home, 'projects', 'p1', 'sessions', 'sess-S');
    const swDir = join(sessionDir, 'agent-workspace', 'planner-lead');
    await mkdir(swDir, { recursive: true });
    await writeFile(join(sessionDir, 'transcript.jsonl'), '', 'utf8');
    await writeFile(
      join(swDir, 'sandwich.assembled.md'),
      '# planner-lead sandwich (assembled for sess-S)\n',
      'utf8',
    );
    const glob = posix.join(
      home.split(sep).join('/'),
      'projects',
      '*',
      'sessions',
      '*',
      'transcript.jsonl',
    );
    const server = await startStudioServer({
      port: 0,
      bind: '127.0.0.1',
      glob,
      pollInterval: 50,
    });
    try {
      await new Promise((r) => setTimeout(r, 200));
      const r = await fetch(server.url + 'api/sessions/sess-S/sandwich/planner-lead');
      expect(r.status).toBe(200);
      const body = await r.text();
      expect(body).toContain('planner-lead sandwich');
    } finally {
      await server.close();
    }
  });

  it('POST /api/sessions/:id/inbox appends to <session>/inbox.txt', async () => {
    const home = await mkdtemp(join(tmpdir(), 'crumb-dash-'));
    const sessionDir = join(home, 'projects', 'p1', 'sessions', 'sess-IN');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, 'transcript.jsonl'), '', 'utf8');
    const glob = posix.join(
      home.split(sep).join('/'),
      'projects',
      '*',
      'sessions',
      '*',
      'transcript.jsonl',
    );
    const server = await startStudioServer({
      port: 0,
      bind: '127.0.0.1',
      glob,
      pollInterval: 50,
    });
    try {
      await new Promise((r) => setTimeout(r, 200));
      const res = await fetch(server.url + 'api/sessions/sess-IN/inbox', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ line: '/goto verifier check D5' }),
      });
      expect(res.status).toBe(202);
      const body = (await res.json()) as { ok: boolean; line: string };
      expect(body.ok).toBe(true);
      expect(body.line).toBe('/goto verifier check D5');
      const { readFile: readF } = await import('node:fs/promises');
      const inbox = await readF(join(sessionDir, 'inbox.txt'), 'utf8');
      expect(inbox).toContain('/goto verifier check D5');
    } finally {
      await server.close();
    }
  });

  it('POST /api/sessions/:id/inbox rejects unknown session', async () => {
    const home = await mkdtemp(join(tmpdir(), 'crumb-dash-'));
    const glob = posix.join(
      home.split(sep).join('/'),
      'projects',
      '*',
      'sessions',
      '*',
      'transcript.jsonl',
    );
    const server = await startStudioServer({ port: 0, bind: '127.0.0.1', glob });
    try {
      const res = await fetch(server.url + 'api/sessions/nope/inbox', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ line: 'hello' }),
      });
      expect(res.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it('rejects sandwich requests with traversal in actor name', async () => {
    const home = await mkdtemp(join(tmpdir(), 'crumb-dash-'));
    const sessionDir = join(home, 'projects', 'p1', 'sessions', 'sess-T');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, 'transcript.jsonl'), '', 'utf8');
    const glob = posix.join(
      home.split(sep).join('/'),
      'projects',
      '*',
      'sessions',
      '*',
      'transcript.jsonl',
    );
    const server = await startStudioServer({
      port: 0,
      bind: '127.0.0.1',
      glob,
      pollInterval: 50,
    });
    try {
      await new Promise((r) => setTimeout(r, 200));
      const r = await fetch(server.url + 'api/sessions/sess-T/sandwich/..%2Fevil');
      // path-traversal characters survive URL-decoding into the regex check
      expect([400, 404]).toContain(r.status);
    } finally {
      await server.close();
    }
  });
});
