import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve as resolvePath, join as joinPath } from 'node:path';

import { check, formatHuman, formatJson } from './init.js';

function makeTmpRoot(): string {
  return mkdtempSync(joinPath(tmpdir(), 'crumb-init-test-'));
}

function touch(root: string, rel: string): void {
  const full = resolvePath(root, rel);
  mkdirSync(joinPath(full, '..'), { recursive: true });
  writeFileSync(full, '');
}

describe('init.check', () => {
  let root: string;

  beforeEach(() => {
    root = makeTmpRoot();
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports all missing on empty project', () => {
    const r = check({ projectRoot: root });
    expect(r.ok).toBe(false);
    expect(r.identity.every((i) => !i.present)).toBe(true);
    expect(r.hosts).toHaveLength(3);
    expect(r.hosts.every((h) => !h.ok)).toBe(true);
  });

  it('reports OK when all entries + identity present', () => {
    touch(root, 'CRUMB.md');
    touch(root, 'AGENTS.md');
    touch(root, '.claude/skills/crumb/SKILL.md');
    touch(root, '.codex/agents/crumb.toml');
    touch(root, '.gemini/extensions/crumb/gemini-extension.json');
    touch(root, '.gemini/extensions/crumb/GEMINI.md');
    touch(root, '.gemini/extensions/crumb/commands/crumb.toml');

    const r = check({ projectRoot: root });
    expect(r.ok).toBe(true);
    expect(r.identity.every((i) => i.present)).toBe(true);
    expect(r.hosts.every((h) => h.ok)).toBe(true);
  });

  it('filters to a single host when filter !== "all"', () => {
    const r = check({ projectRoot: root, filter: 'codex' });
    expect(r.hosts).toHaveLength(1);
    expect(r.hosts[0].host).toBe('codex');
  });

  it('detects partial gemini install', () => {
    touch(root, 'CRUMB.md');
    touch(root, 'AGENTS.md');
    touch(root, '.gemini/extensions/crumb/gemini-extension.json');
    // GEMINI.md and commands/crumb.toml missing

    const r = check({ projectRoot: root, filter: 'gemini' });
    expect(r.ok).toBe(false);
    const gemini = r.hosts[0];
    expect(gemini.host).toBe('gemini');
    expect(gemini.ok).toBe(false);
    expect(gemini.files.filter((f) => f.present)).toHaveLength(1);
    expect(gemini.files.filter((f) => !f.present)).toHaveLength(2);
  });
});

describe('formatHuman', () => {
  it('produces sectioned text output', () => {
    const r = check({ projectRoot: '/nonexistent' });
    const text = formatHuman(r);
    expect(text).toContain('# Crumb host entries');
    expect(text).toContain('## Universal identity');
    expect(text).toContain('## Host entries');
    expect(text).toContain('Status: missing files');
    expect(text).toContain('Hint:');
  });

  it('omits hint when ok', () => {
    const root = makeTmpRoot();
    try {
      touch(root, 'CRUMB.md');
      touch(root, 'AGENTS.md');
      touch(root, '.claude/skills/crumb/SKILL.md');
      touch(root, '.codex/agents/crumb.toml');
      touch(root, '.gemini/extensions/crumb/gemini-extension.json');
      touch(root, '.gemini/extensions/crumb/GEMINI.md');
      touch(root, '.gemini/extensions/crumb/commands/crumb.toml');
      const r = check({ projectRoot: root });
      const text = formatHuman(r);
      expect(text).toContain('Status: OK');
      expect(text).not.toContain('Hint:');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('formatJson', () => {
  it('produces parseable JSON with identity + hosts + ok', () => {
    const r = check({ projectRoot: '/nonexistent' });
    const json = formatJson(r);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty('identity');
    expect(parsed).toHaveProperty('hosts');
    expect(parsed).toHaveProperty('ok');
    expect(parsed.ok).toBe(false);
    expect(Array.isArray(parsed.hosts)).toBe(true);
  });
});
