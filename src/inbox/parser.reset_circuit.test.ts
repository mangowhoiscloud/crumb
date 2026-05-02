import { describe, expect, it } from 'vitest';

import { parseInboxLine } from './parser.js';

describe('parseInboxLine — /reset_circuit underscore alias', () => {
  it('accepts /reset_circuit builder (underscore form)', () => {
    const draft = parseInboxLine('/reset_circuit builder', 'sess-1');
    expect(draft).not.toBeNull();
    expect(draft?.kind).toBe('user.intervene');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.reset_circuit).toBe('builder');
  });

  it('still accepts the original /reset-circuit hyphen form', () => {
    const draft = parseInboxLine('/reset-circuit builder', 'sess-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.reset_circuit).toBe('builder');
  });

  it('accepts /reset_circuit all', () => {
    const draft = parseInboxLine('/reset_circuit all', 'sess-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.reset_circuit).toBe(true);
  });
});
