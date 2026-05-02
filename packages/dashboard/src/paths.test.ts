import { describe, expect, it } from 'vitest';

import {
  projectIdFromPath,
  sandwichPath,
  sessionDirFromTranscript,
  sessionIdFromPath,
} from './paths.js';

describe('dashboard path helpers', () => {
  const sample = '/Users/mango/.crumb/projects/596ee4eeb63e64ef/sessions/01HSESS/transcript.jsonl';

  it('sessionIdFromPath extracts the ULID directory', () => {
    expect(sessionIdFromPath(sample)).toBe('01HSESS');
  });

  it('projectIdFromPath extracts the projectId directory', () => {
    expect(projectIdFromPath(sample)).toBe('596ee4eeb63e64ef');
  });

  it('projectIdFromPath returns empty string for malformed paths', () => {
    expect(projectIdFromPath('transcript.jsonl')).toBe('');
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
