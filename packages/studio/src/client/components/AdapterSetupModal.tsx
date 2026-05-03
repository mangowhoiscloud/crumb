/**
 * AdapterSetupModal — v0.5 PR-Auth click → setup instructions surface.
 *
 * Triggered by clicking an AdapterRow in the Sidebar. The modal renders
 * state-aware copy ("re-login" vs "first install" vs "needs setup")
 * derived from the AdapterStatus probe (authenticated + login_expires_at
 * + auth_source from server-side keychain/JWT/OAuth probe — see
 * packages/studio/src/server/doctor.ts).
 *
 * Each install/auth hint becomes a copy-on-click command block —
 * GitHub gist + DevTools console snippet UX. navigator.clipboard fails
 * silently in insecure contexts; the user can still manually select.
 *
 * AGENTS.md §invariant 7 — the modal is read-only: it shows what to
 * type, never executes anything. Studio remains a strict observation
 * surface; auth flows happen in the user's terminal.
 */

import { useEffect, useState } from 'react';
import type { AdapterStatus } from '../lib/api';

interface Props {
  adapter: AdapterStatus | null;
  onClose: () => void;
  onRefetch: () => void;
}

type AuthState = 'ok' | 'expired' | 'missing' | 'unknown';

function deriveAuthState(a: AdapterStatus): AuthState {
  // Server-side doctor.ts emits authenticated:boolean|null + optional
  // login_expires_at. Translate into a 4-state for UX:
  //   - ok: authenticated=true (creds live, no need to re-login)
  //   - expired: authenticated=false AND login_expires_at present (creds
  //     on disk but past expiry → run /login to refresh)
  //   - missing: authenticated=false AND no login_expires_at (binary
  //     installed but never logged in, or binary missing → first login
  //     OR install)
  //   - unknown: authenticated=null (binary present but probe path
  //     unavailable, e.g. claude on linux without keychain)
  if (a.authenticated === true) return 'ok';
  if (a.authenticated === null) return 'unknown';
  return a.login_expires_at ? 'expired' : 'missing';
}

function formatRelativeTime(iso: string): string {
  const exp = Date.parse(iso);
  if (!Number.isFinite(exp)) return '';
  const ms = exp - Date.now();
  const abs = Math.abs(ms);
  let value: string;
  if (abs < 60_000) value = `${Math.round(abs / 1000)}s`;
  else if (abs < 3_600_000) value = `${Math.round(abs / 60_000)}m`;
  else if (abs < 86_400_000) value = `${Math.round(abs / 3_600_000)}h`;
  else value = `${Math.round(abs / 86_400_000)}d`;
  return ms > 0 ? `expires in ${value}` : `expired ${value} ago`;
}

function CopyableCmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable in insecure contexts — user can select manually */
    }
  };
  return (
    <div
      onClick={() => void onClick()}
      title="click to copy"
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: 'var(--r-sm)',
        background: 'var(--surface-2)',
        border: '1px solid var(--hairline)',
        padding: '8px 70px 8px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        marginTop: 4,
      }}
    >
      <span>{cmd}</span>
      <span
        style={{
          position: 'absolute',
          top: '50%',
          right: 10,
          transform: 'translateY(-50%)',
          fontSize: 10,
          color: copied ? 'var(--lime)' : 'var(--ink-tertiary)',
          letterSpacing: '0.3px',
          userSelect: 'none',
        }}
      >
        {copied ? '✓ copied' : '⧉ copy'}
      </span>
    </div>
  );
}

export function AdapterSetupModal({ adapter, onClose, onRefetch }: Props) {
  // Esc closes modal — keyboard parity with the rest of the studio.
  useEffect(() => {
    if (!adapter) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [adapter, onClose]);

  if (!adapter) return null;

  const a = adapter;
  const state = deriveAuthState(a);
  const expiryText = a.login_expires_at ? formatRelativeTime(a.login_expires_at) : '';

  let glyph: string;
  let stateText: string;
  let actionLabel: string | null;
  let actionCommand: string | null;
  if (state === 'ok') {
    glyph = '✓';
    stateText = 'installed and authenticated' + (expiryText ? ` · ${expiryText}` : '');
    actionLabel = null;
    actionCommand = null;
  } else if (state === 'expired') {
    glyph = '⏰';
    stateText = `installed but credentials expired${expiryText ? ` (${expiryText})` : ''}`;
    actionLabel = 're-login';
    actionCommand = a.auth_hint ?? null;
  } else if (state === 'missing') {
    glyph = '✗';
    stateText = a.installed ? 'installed but not authenticated' : 'not installed';
    actionLabel = a.installed ? 'first login' : 'install';
    actionCommand = (a.installed ? a.auth_hint : a.install_hint) ?? null;
  } else {
    glyph = '◐';
    stateText = 'installed (auth probe unavailable on this platform)';
    actionLabel = 'login (if needed)';
    actionCommand = a.auth_hint ?? null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
          background: 'var(--surface-card, var(--canvas))',
          color: 'var(--ink)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--space-4)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          fontFamily: 'var(--font-sans, system-ui)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-muted)',
            fontSize: 18,
            cursor: 'pointer',
            width: 28,
            height: 28,
          }}
        >
          ×
        </button>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14 }}>{a.display_name} — setup</h3>

        <Section label="current status">
          <div style={{ fontSize: 12 }}>
            {glyph} {stateText}
            {a.version && (
              <span style={{ color: 'var(--ink-subtle)', marginLeft: 6 }}>· {a.version}</span>
            )}
          </div>
          {a.email && state === 'ok' && (
            <div style={{ fontSize: 11, color: 'var(--ink-subtle)', marginTop: 2 }}>
              signed in as {a.email}
            </div>
          )}
        </Section>

        {actionCommand && (
          <Section label={actionLabel ?? 'action'}>
            <CopyableCmd cmd={actionCommand} />
          </Section>
        )}

        {state !== 'missing' && a.install_hint && (
          <Section label="reinstall / upgrade">
            <CopyableCmd cmd={a.install_hint} />
          </Section>
        )}

        {a.models && a.models.length > 0 && (
          <Section label="models">
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-subtle)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {a.models.join(' · ')}
            </div>
          </Section>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onRefetch}
            style={{
              fontSize: 11,
              padding: '5px 12px',
              background: 'var(--primary)',
              color: 'var(--surface-card, white)',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Re-check status
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 11,
              padding: '5px 12px',
              background: 'transparent',
              color: 'var(--ink-muted)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          color: 'var(--ink-tertiary)',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
