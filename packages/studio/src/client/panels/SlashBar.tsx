/**
 * SlashBar — bottom-of-Studio command input.
 *
 * Per migration plan §6 + DESIGN.md §4.10. Single-line input with chip
 * row beneath ( /approve · /veto rebuild · /pause · /resume · /goto
 * verifier · @builder use red palette · /note <text> · /redo ).
 *
 * Enter (or Cmd+Enter) submits to `POST /api/sessions/:id/inbox` —
 * preserves AGENTS.md §invariant 1+7 (Studio never writes transcript
 * directly; the dispatcher consumes inbox.txt + emits events).
 *
 * §8.1 quality bar — empty / pending / error states explicit.
 * No client-side parsing of the slash command — server's
 * src/inbox/parser.ts owns grammar.
 */

import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { useActiveSession } from '../stores/selection';

const QUICK_CHIPS = [
  '/approve',
  '/veto rebuild',
  '/pause',
  '/resume',
  '/goto verifier',
  '@builder use red palette',
  '/note ',
  '/redo',
  // v0.5 PR-Inbox-Console — Tier 2 enum chips. Reducer routes via the
  // ask-formatter helper (LLM-zero, replay-deterministic), response
  // lands as `kind=note` in the InboxThread within ≤500ms.
  '/ask status',
  '/ask cost',
  '/ask next',
  '/ask stuck',
  '/ask scorecard',
];

const ALL_COMMANDS = [
  '/approve',
  '/veto ',
  '/pause',
  '/resume',
  '/goto ',
  '/swap ',
  '/append ',
  '/note ',
  '/redo',
  '/cancel',
  '/reset-circuit ',
  '/ask status',
  '/ask cost',
  '/ask next',
  '/ask stuck',
  '/ask scorecard',
];

const HISTORY_CAP = 50;

export function SlashBar() {
  const sessionId = useActiveSession();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  // v0.5 PR-Inbox-Console — input history (terminal pattern). ↑↓ navigates;
  // newest entry at the end. Caps at HISTORY_CAP so the array doesn't grow
  // unbounded across long sessions. Module-scope would persist across
  // session switches; in-component is the right scope (history is per-tab).
  const historyRef = useRef<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const submit = async (): Promise<void> => {
    if (!sessionId) {
      setFeedback({ text: 'no active session', tone: 'err' });
      return;
    }
    const line = text.trim();
    if (!line) return;
    // v0.5 PR-Inbox-Console — `/help` is a local-only command. The
    // InboxThread renders the cheatsheet card inline; submitting
    // anything else falls through to /api/sessions/:id/inbox. We don't
    // want /help to write to inbox.txt because it's a UI-only verb;
    // the parser would silently route it to free-text user.intervene.
    if (line === '/help') {
      setText('');
      setFeedback({ text: 'see the cheatsheet at the top of the InboxThread panel', tone: 'ok' });
      return;
    }
    setPending(true);
    try {
      await api.inboxAppend(sessionId, line);
      // Push into history (dedupe consecutive duplicates).
      const h = historyRef.current;
      if (h[h.length - 1] !== line) {
        h.push(line);
        if (h.length > HISTORY_CAP) h.shift();
      }
      setHistoryIdx(-1);
      setText('');
      setFeedback({ text: `posted · ${line.slice(0, 40)}`, tone: 'ok' });
    } catch (err) {
      setFeedback({ text: (err as Error).message, tone: 'err' });
    } finally {
      setPending(false);
    }
  };

  const insertChip = (chip: string): void => {
    setText((prev) => (prev ? `${prev} ${chip}` : chip));
  };

  // v0.5 PR-Inbox-Console — `/`-prefix completion. Cursor / Claude Code
  // REPL pattern: dropdown menu above the input shows live matches;
  // `Tab` or `Enter` accepts the highlighted entry; ↑↓ navigates within
  // the menu (history nav suppressed while menu open). Matches drawn
  // from ALL_COMMANDS. Empty when input doesn't start with `/`.
  const completions = text.startsWith('/')
    ? ALL_COMMANDS.filter((c) => c.toLowerCase().startsWith(text.toLowerCase())).slice(0, 8)
    : [];
  const [completionIdx, setCompletionIdx] = useState<number>(0);
  // Reset selection cursor whenever the match list shrinks/grows so we
  // never index out of range.
  if (completionIdx > 0 && completionIdx >= completions.length) {
    setCompletionIdx(0);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--hairline)',
        position: 'relative',
      }}
    >
      {/* v0.5 PR-Inbox-Console — `/`-prefix completion dropdown.
          Floats above the input row (absolute, bottom-anchored) so the
          row's natural keyboard focus stays on the input. ↑↓ navigates;
          Enter / Tab accepts the highlighted entry; click also accepts.
          Hidden when input doesn't start with `/`. */}
      {completions.length > 0 && (
        <div
          role="listbox"
          aria-label="Slash command suggestions"
          style={{
            position: 'absolute',
            left: 'var(--space-3)',
            right: 'var(--space-3)',
            bottom: 'calc(100% - var(--space-2))',
            background: 'var(--surface-card, var(--canvas))',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-sm)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {completions.map((c, i) => (
            <div
              key={c}
              role="option"
              aria-selected={i === completionIdx}
              onMouseEnter={() => setCompletionIdx(i)}
              onMouseDown={(e) => {
                // mousedown (not click) so the input doesn't blur first;
                // setText runs while focus stays on the input.
                e.preventDefault();
                setText(c);
                setCompletionIdx(0);
              }}
              style={{
                padding: '4px 10px',
                cursor: 'pointer',
                color: i === completionIdx ? 'var(--ink)' : 'var(--ink-muted)',
                background: i === completionIdx ? 'var(--surface-2)' : 'transparent',
                borderLeft:
                  i === completionIdx
                    ? '2px solid var(--primary)'
                    : '2px solid transparent',
              }}
            >
              {c}
            </div>
          ))}
          <div
            style={{
              padding: '3px 10px',
              fontSize: 9,
              color: 'var(--ink-tertiary)',
              borderTop: '1px solid var(--hairline-soft)',
              letterSpacing: '0.3px',
            }}
          >
            ↑↓ navigate · Enter / Tab accept · Esc close
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            sessionId
              ? 'slash command, @actor mention, or plain text intervention'
              : 'select a session in the sidebar'
          }
          disabled={!sessionId || pending}
          onKeyDown={(e) => {
            // When the autocomplete menu is open, ↑↓ navigates the menu
            // (not the history) and Enter / Tab accepts the highlighted
            // entry. Esc closes the menu (clears completionIdx).
            const menuOpen = completions.length > 0;
            if (menuOpen && e.key === 'ArrowDown') {
              e.preventDefault();
              setCompletionIdx((prev) => Math.min(completions.length - 1, prev + 1));
              return;
            }
            if (menuOpen && e.key === 'ArrowUp') {
              e.preventDefault();
              setCompletionIdx((prev) => Math.max(0, prev - 1));
              return;
            }
            if (menuOpen && (e.key === 'Tab' || e.key === 'Enter')) {
              e.preventDefault();
              const pick = completions[completionIdx] ?? completions[0];
              if (pick) setText(pick);
              setCompletionIdx(0);
              return;
            }
            if (menuOpen && e.key === 'Escape') {
              e.preventDefault();
              // Snap input back to a non-`/` prefix so completions[]
              // collapses to []; user keeps what they typed minus the
              // leading slash. (Pressing Escape == "I don't want
              // suggestions" — same convention as VS Code IntelliSense.)
              setText((prev) => (prev.startsWith('/') ? prev.slice(1) : prev));
              setCompletionIdx(0);
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
              return;
            }
            // Below this point: menu is closed. ↑↓ → history navigation.
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              const h = historyRef.current;
              if (h.length === 0) return;
              const next = historyIdx === -1 ? h.length - 1 : Math.max(0, historyIdx - 1);
              setHistoryIdx(next);
              setText(h[next] ?? '');
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              const h = historyRef.current;
              if (historyIdx === -1) return;
              if (historyIdx < h.length - 1) {
                const next = historyIdx + 1;
                setHistoryIdx(next);
                setText(h[next] ?? '');
              } else {
                setHistoryIdx(-1);
                setText('');
              }
            }
          }}
          style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            padding: '6px 10px',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--canvas)',
            color: 'var(--ink)',
          }}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!sessionId || pending || !text.trim()}
          style={{
            background: 'var(--primary)',
            color: 'var(--surface-card)',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 14px',
            border: 'none',
            borderRadius: 'var(--r-sm)',
            opacity: !sessionId || pending || !text.trim() ? 0.5 : 1,
            cursor: !sessionId || pending || !text.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => insertChip(chip)}
            disabled={!sessionId}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '3px 8px',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-pill)',
              background: 'transparent',
              color: 'var(--ink-muted)',
              cursor: sessionId ? 'pointer' : 'not-allowed',
              opacity: sessionId ? 1 : 0.5,
            }}
          >
            {chip}
          </button>
        ))}
      </div>
      {feedback && (
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: feedback.tone === 'err' ? 'var(--audit-fg)' : 'var(--ink-subtle)',
          }}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
