/**
 * inbox.txt parser — converts a single user-typed line into a transcript-ready
 * DraftMessage. Same line grammar the TUI's slash-command bar accepts so muscle
 * memory transfers between TUI and headless modes.
 *
 * Grammar (one line = one event):
 *
 *   /pause [reason]                         → kind=user.pause, body=reason
 *   /resume                                  → kind=user.resume
 *   /resume @<actor>                         → kind=user.resume, data.actor=<actor>
 *   /pause @<actor> [reason]                 → kind=user.pause,  data.actor=<actor>, body=reason
 *   /approve                                 → kind=user.approve
 *   /veto <msg-id>                           → kind=user.veto, data.target_msg_id=<id>
 *   /goto <actor> [body...]                  → kind=user.intervene, data.goto=<actor>, body=...
 *   /swap <from>=<adapter>                   → kind=user.intervene, data.swap={from,to}
 *   /reset-circuit <actor|all>               → kind=user.intervene, data.reset_circuit=<actor>|true
 *   /append [@<actor>] <text>                → kind=user.intervene, data.sandwich_append=<text>
 *                                              (+ data.target_actor when @<actor> present)  — v0.2.0 G4
 *   /note <text>                             → kind=note, body=<text>
 *   /redo [body]                             → kind=user.intervene, body=<body>  (alias for free-text)
 *   @<actor> <body>                          → kind=user.intervene, data.target_actor=<actor>, body=<body>
 *   <free text>                              → kind=user.intervene, body=<line>
 *
 * Lines starting with `#` or empty lines are ignored (comments / blank).
 *
 * See [[bagelcode-user-intervention-frontier-2026-05-02]] §"6 data fields".
 */

import type { Actor, DraftMessage, Kind } from '../protocol/types.js';

const ACTOR_NAMES: ReadonlySet<Actor> = new Set([
  'user',
  'coordinator',
  'planner-lead',
  'builder',
  'verifier',
  'builder-fallback',
  'validator',
  'system',
]);

function isActor(s: string): s is Actor {
  return ACTOR_NAMES.has(s as Actor);
}

/** Parse a single inbox.txt line. Returns null for blank / comment lines. */
export function parseInboxLine(line: string, sessionId: string): DraftMessage | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  // Slash-command grammar
  if (trimmed.startsWith('/')) {
    return parseSlash(trimmed, sessionId);
  }

  // @<actor> <body> grammar
  if (trimmed.startsWith('@')) {
    const m = trimmed.match(/^@([\w-]+)\s+(.+)$/);
    if (m && isActor(m[1])) {
      return {
        session_id: sessionId,
        from: 'user',
        kind: 'user.intervene' satisfies Kind,
        body: m[2].trim(),
        data: { target_actor: m[1] },
      };
    }
    // @<unknown> falls through to free-text
  }

  // Free text → user.intervene
  return {
    session_id: sessionId,
    from: 'user',
    kind: 'user.intervene' satisfies Kind,
    body: trimmed,
  };
}

function parseSlash(line: string, sessionId: string): DraftMessage | null {
  const m = line.match(/^\/(\S+)\s*(.*)$/);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const rest = m[2].trim();

  switch (cmd) {
    case 'pause': {
      const at = rest.match(/^@([\w-]+)\s*(.*)$/);
      if (at && isActor(at[1])) {
        return {
          session_id: sessionId,
          from: 'user',
          kind: 'user.pause',
          body: at[2].trim() || undefined,
          data: { actor: at[1] },
        };
      }
      return {
        session_id: sessionId,
        from: 'user',
        kind: 'user.pause',
        body: rest || undefined,
      };
    }
    case 'resume': {
      const at = rest.match(/^@([\w-]+)$/);
      if (at && isActor(at[1])) {
        return {
          session_id: sessionId,
          from: 'user',
          kind: 'user.resume',
          data: { actor: at[1] },
        };
      }
      return { session_id: sessionId, from: 'user', kind: 'user.resume' };
    }
    case 'approve':
      return { session_id: sessionId, from: 'user', kind: 'user.approve' };
    case 'veto':
      return {
        session_id: sessionId,
        from: 'user',
        kind: 'user.veto',
        data: rest ? { target_msg_id: rest } : undefined,
      };
    case 'goto': {
      const g = rest.match(/^([\w-]+)(?:\s+(.*))?$/);
      if (g && isActor(g[1])) {
        return {
          session_id: sessionId,
          from: 'user',
          kind: 'user.intervene',
          body: g[2]?.trim() || undefined,
          data: { goto: g[1] },
        };
      }
      return null;
    }
    case 'swap': {
      // /swap <from>=<adapter>
      const s = rest.match(/^([\w-]+)=([\w-]+)$/);
      if (s && isActor(s[1])) {
        return {
          session_id: sessionId,
          from: 'user',
          kind: 'user.intervene',
          data: { swap: { from: s[1], to: s[2] } },
        };
      }
      return null;
    }
    // Underscore alias: the MCP tool exposes /reset_circuit and users type
    // both forms. Accept either so /reset_circuit doesn't silently fall
    // through to free-text intervene (real footgun in session 01KQNAK1).
    case 'reset_circuit':
    case 'reset-circuit': {
      if (rest === 'all') {
        return {
          session_id: sessionId,
          from: 'user',
          kind: 'user.intervene',
          data: { reset_circuit: true },
        };
      }
      if (isActor(rest)) {
        return {
          session_id: sessionId,
          from: 'user',
          kind: 'user.intervene',
          data: { reset_circuit: rest },
        };
      }
      return null;
    }
    case 'append': {
      // v0.2.0 G4 — runtime sandwich append. Optional @<actor> prefix scopes the
      // append to one actor; absent prefix broadcasts to every spawn.
      const at = rest.match(/^@([\w-]+)\s+(.+)$/);
      if (at && isActor(at[1])) {
        return {
          session_id: sessionId,
          from: 'user',
          kind: 'user.intervene',
          data: { target_actor: at[1], sandwich_append: at[2].trim() },
        };
      }
      if (!rest) return null;
      return {
        session_id: sessionId,
        from: 'user',
        kind: 'user.intervene',
        data: { sandwich_append: rest },
      };
    }
    case 'note': {
      if (!rest) return null;
      return {
        session_id: sessionId,
        from: 'user',
        kind: 'note',
        body: rest,
      };
    }
    case 'redo': {
      // Alias for free-text user.intervene — preserves TUI muscle memory.
      return {
        session_id: sessionId,
        from: 'user',
        kind: 'user.intervene',
        body: rest || undefined,
      };
    }
    default:
      // Unknown slash → treat the entire line as free text
      return {
        session_id: sessionId,
        from: 'user',
        kind: 'user.intervene',
        body: line,
      };
  }
}
