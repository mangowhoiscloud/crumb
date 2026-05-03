/**
 * Tests for the pause/resume lifecycle self-check helper. The helper is
 * pure — no I/O — so we exercise it directly + verify the verdict + per-step
 * pass/fail surface. Backed by wiki/synthesis/bagelcode-studio-big-bang-
 * update-2026-05-03.md §6.8.
 */

import { describe, it, expect } from 'vitest';
import { runSelfCheck, formatSelfCheckReport } from './self-check.js';

describe('runSelfCheck — pause/resume lifecycle smoke', () => {
  it('returns ok verdict on a healthy reducer', () => {
    const report = runSelfCheck();
    expect(report.pause_resume_lifecycle).toBe('ok');
  });

  it('every step passes', () => {
    const report = runSelfCheck();
    const failed = report.steps.filter((s) => s.status === 'fail');
    expect(failed).toEqual([]);
  });

  it('exercises both global and per-actor pause/resume', () => {
    const report = runSelfCheck();
    const stepNames = report.steps.map((s) => s.step);
    expect(stepNames).toContain('user.pause (global) → paused === true');
    expect(stepNames).toContain('user.resume (global) → paused === false');
    expect(stepNames).toContain('user.pause (builder) → paused_actors contains builder');
    expect(stepNames).toContain('user.resume (builder) → paused_actors empty');
  });

  it('checks per-actor pause does not leak to global state', () => {
    const report = runSelfCheck();
    const step = report.steps.find((s) => s.step.includes('does NOT set global paused'));
    expect(step).toBeDefined();
    expect(step?.status).toBe('pass');
  });

  it('checks idempotency of repeated per-actor pause', () => {
    const report = runSelfCheck();
    const step = report.steps.find((s) => s.step.includes('idempotent'));
    expect(step).toBeDefined();
    expect(step?.status).toBe('pass');
  });

  it('reports duration_ms', () => {
    const report = runSelfCheck();
    expect(report.duration_ms).toBeGreaterThanOrEqual(0);
    // Pure-function smoke should complete instantly.
    expect(report.duration_ms).toBeLessThan(500);
  });
});

describe('formatSelfCheckReport', () => {
  it('renders the verdict with a glyph', () => {
    const report = runSelfCheck();
    const rendered = formatSelfCheckReport(report);
    expect(rendered).toMatch(/^✅ pause\/resume lifecycle: ok/);
  });

  it('lists every step', () => {
    const report = runSelfCheck();
    const rendered = formatSelfCheckReport(report);
    for (const step of report.steps) {
      expect(rendered).toContain(step.step);
    }
  });

  it('marks failures with ✗ when present (synthetic broken report)', () => {
    const broken = {
      pause_resume_lifecycle: 'broken' as const,
      duration_ms: 1,
      steps: [{ step: 'fake', status: 'fail' as const, detail: 'because' }],
    };
    const rendered = formatSelfCheckReport(broken);
    expect(rendered).toContain('❌ pause/resume lifecycle: broken');
    expect(rendered).toContain('  ✗ fake — because');
  });
});
