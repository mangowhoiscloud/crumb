#!/usr/bin/env node
/**
 * Claude Code Stop hook for Crumb.
 *
 * After each turn, if there is an in-flight Crumb session in this project,
 * print a single line:  "[crumb] <session> · <last_kind> · agg=<n> verdict=<x>"
 *
 * Plain text → Claude Code surfaces it as system context. Silent on no in-flight session.
 * No external deps; Node 18+ builtins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

function main() {
  const projectId = resolveProjectId(process.cwd());
  if (!projectId) return;
  const sessionsDir = path.join(os.homedir(), '.crumb', 'projects', projectId, 'sessions');
  if (!fs.existsSync(sessionsDir)) return;

  const latest = mostRecentInFlight(sessionsDir);
  if (!latest) return;

  const tail = readLastJsonLine(path.join(sessionsDir, latest.id, 'transcript.jsonl'));
  const kind = tail?.kind ?? '?';
  const score = extractScore(tail);
  const scoreFrag = score ? ` · agg=${score.aggregate ?? '?'} verdict=${score.verdict ?? '?'}` : '';
  process.stdout.write(`[crumb] ${latest.id} · ${kind}${scoreFrag}\n`);
}

function resolveProjectId(cwd) {
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
  return crypto.createHash('sha256').update(path.resolve(cwd)).digest('hex').slice(0, 16);
}

function mostRecentInFlight(sessionsDir) {
  let entries;
  try {
    entries = fs.readdirSync(sessionsDir);
  } catch {
    return null;
  }
  let best = null;
  for (const id of entries) {
    const metaPath = path.join(sessionsDir, id, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      continue;
    }
    if (meta.status !== 'running' && meta.status !== 'paused') continue;
    if (!best || (meta.started_at ?? '') > (best.started_at ?? '')) {
      best = { id, status: meta.status, started_at: meta.started_at };
    }
  }
  return best;
}

function readLastJsonLine(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) return null;
  try {
    const buf = fs.readFileSync(transcriptPath, 'utf8');
    const lines = buf.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

function extractScore(msg) {
  if (!msg || !msg.scores) return null;
  return {
    aggregate: msg.scores.aggregate,
    verdict: msg.scores.verdict,
  };
}

try {
  main();
} catch {
  // Never fail Claude Code Stop.
}
