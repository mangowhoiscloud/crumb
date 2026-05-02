#!/usr/bin/env node
/**
 * Claude Code SessionStart hook for Crumb.
 *
 * On every Claude Code session entry, surface:
 *   - any in-flight Crumb sessions in this project (status=running|paused) with goal + last kind
 *   - a one-line preset-availability hint (skipped if it would slow startup; this script stays
 *     synchronous + dependency-free)
 *
 * Output: plain text on stdout → Claude Code injects it as additional context.
 * Errors: silenced (non-fatal — hook must never block session start).
 *
 * No external deps. Uses Node 18+ builtins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

function main() {
  const projectId = resolveProjectId(process.cwd());
  if (!projectId) return;
  const projectDir = path.join(os.homedir(), '.crumb', 'projects', projectId);
  const sessionsDir = path.join(projectDir, 'sessions');
  if (!fs.existsSync(sessionsDir)) return;

  const inFlight = listInFlightSessions(sessionsDir);
  if (inFlight.length === 0) return;

  const lines = ['# Crumb — in-flight session(s) detected'];
  for (const s of inFlight.slice(0, 3)) {
    const goal = s.goal ? truncate(s.goal, 70) : '(no goal recorded)';
    const kindHint = s.last_kind ? ` · last kind: ${s.last_kind}` : '';
    lines.push(`- \`${s.id}\` [${s.status}] — ${goal}${kindHint}`);
  }
  if (inFlight.length > 3) {
    lines.push(`- (… ${inFlight.length - 3} more, see \`crumb ls\`)`);
  }
  lines.push('');
  lines.push(
    'Tools: `mcp__crumb__crumb_status` for progress, `mcp__crumb__crumb_suggest` for next action, `/crumb-watch <id>` for both.',
  );
  process.stdout.write(lines.join('\n') + '\n');
}

function resolveProjectId(cwd) {
  // Pin file first.
  const pinPath = path.join(cwd, '.crumb', 'project.toml');
  if (fs.existsSync(pinPath)) {
    try {
      const content = fs.readFileSync(pinPath, 'utf8');
      const m = content.match(/^\s*(?:id|project_id)\s*=\s*"([^"]+)"/m);
      if (m) return m[1];
    } catch {
      // fall through
    }
  }
  // Ambient: sha256(canonical cwd)[:16].
  return crypto.createHash('sha256').update(path.resolve(cwd)).digest('hex').slice(0, 16);
}

function listInFlightSessions(sessionsDir) {
  let entries;
  try {
    entries = fs.readdirSync(sessionsDir);
  } catch {
    return [];
  }
  const out = [];
  for (const id of entries) {
    const sessionDir = path.join(sessionsDir, id);
    const metaPath = path.join(sessionDir, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      continue;
    }
    if (meta.status !== 'running' && meta.status !== 'paused') continue;
    out.push({
      id,
      status: meta.status,
      goal: meta.goal,
      started_at: meta.started_at,
      last_kind: lastKind(path.join(sessionDir, 'transcript.jsonl')),
    });
  }
  out.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  return out;
}

function lastKind(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) return null;
  try {
    const buf = fs.readFileSync(transcriptPath, 'utf8');
    const lines = buf.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const last = JSON.parse(lines[lines.length - 1]);
    return last.kind ?? null;
  } catch {
    return null;
  }
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

try {
  main();
} catch {
  // Never fail Claude Code session entry.
}
