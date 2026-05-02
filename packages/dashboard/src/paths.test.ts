import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  crumbHomeFromPath,
  defaultTranscriptGlobs,
  projectIdFromPath,
  sandwichPath,
  sessionDirFromTranscript,
  sessionIdFromPath,
} from './paths.js';

describe('dashboard path helpers', () => {
  const sample = '/Users/mango/.crumb/projects/596ee4eeb63e64ef/sessions/01HSESS/transcript.jsonl';
  const flatSample = '/Users/mango/workspace/crumb/sessions/01KQJEDSD6/transcript.jsonl';

  it('sessionIdFromPath extracts the ULID directory', () => {
    expect(sessionIdFromPath(sample)).toBe('01HSESS');
  });

  it('sessionIdFromPath also works for legacy flat layout', () => {
    expect(sessionIdFromPath(flatSample)).toBe('01KQJEDSD6');
  });

  it('projectIdFromPath extracts the projectId directory', () => {
    expect(projectIdFromPath(sample)).toBe('596ee4eeb63e64ef');
  });

  it('projectIdFromPath tags legacy flat sessions as (legacy)', () => {
    expect(projectIdFromPath(flatSample)).toBe('(legacy)');
  });

  it('projectIdFromPath returns empty string for malformed paths', () => {
    expect(projectIdFromPath('transcript.jsonl')).toBe('');
  });

  it('crumbHomeFromPath strips both project-scoped and flat layouts', () => {
    expect(crumbHomeFromPath(sample)).toBe('/Users/mango/.crumb');
    expect(crumbHomeFromPath(flatSample)).toBe('/Users/mango/workspace/crumb');
  });

  it('sandwichPath joins agent-workspace + actor + filename', () => {
    expect(sandwichPath('/sessions/01H', 'planner-lead')).toBe(
      '/sessions/01H/agent-workspace/planner-lead/sandwich.assembled.md',
    );
  });

  it('sessionDirFromTranscript drops the trailing filename', () => {
    expect(sessionDirFromTranscript(sample)).toBe(
      '/Users/mango/.crumb/projects/596ee4eeb63e64ef/sessions/01HSESS',
    );
  });
});

describe('defaultTranscriptGlobs', () => {
  const savedHome = process.env.CRUMB_HOME;
  const savedHomes = process.env.CRUMB_HOMES;

  beforeEach(() => {
    delete process.env.CRUMB_HOMES;
  });
  afterEach(() => {
    if (savedHome === undefined) delete process.env.CRUMB_HOME;
    else process.env.CRUMB_HOME = savedHome;
    if (savedHomes === undefined) delete process.env.CRUMB_HOMES;
    else process.env.CRUMB_HOMES = savedHomes;
  });

  it('emits both project-scoped and flat globs per home', () => {
    process.env.CRUMB_HOME = '/tmp/test-home';
    const globs = defaultTranscriptGlobs();
    expect(globs).toContain('/tmp/test-home/projects/*/sessions/*/transcript.jsonl');
    expect(globs).toContain('/tmp/test-home/sessions/*/transcript.jsonl');
  });

  it('emits both layouts for every home in CRUMB_HOMES', () => {
    process.env.CRUMB_HOMES = '/tmp/h1:/tmp/h2';
    const globs = defaultTranscriptGlobs();
    expect(globs).toContain('/tmp/h1/projects/*/sessions/*/transcript.jsonl');
    expect(globs).toContain('/tmp/h1/sessions/*/transcript.jsonl');
    expect(globs).toContain('/tmp/h2/projects/*/sessions/*/transcript.jsonl');
    expect(globs).toContain('/tmp/h2/sessions/*/transcript.jsonl');
  });
});
