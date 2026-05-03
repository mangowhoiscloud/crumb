/**
 * AdapterRow — sidebar row for one adapter (claude-local / codex-local /
 * gemini-cli-local / gemini-sdk / mock).
 *
 * Per DESIGN.md §4.4 — display name + version + plan chip + login-expiry
 * chip + install/auth pill. Three-pill cluster on the right, flex-wrap.
 *
 * Plan + expiry data flow from the M1 server-side probe (#173):
 * doctor.ts reads keychain (claude) / config-file JWT (codex) / OAuth
 * blob (gemini) WITHOUT spawning the CLI, so the row is cheap to render
 * on every refetch.
 */

import type { AdapterStatus } from '../lib/api';

interface Props {
  adapter: AdapterStatus;
  onClick?: () => void;
  inUse?: boolean;
}

const PLAN_LABEL: Record<string, string> = {
  // Anthropic claudeAiOauth.subscriptionType
  max: 'Max',
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
  free: 'Free',
  // OpenAI ChatGPT chatgpt_plan_type
  prolite: 'ChatGPT Pro Lite',
  plus: 'ChatGPT Plus',
  // Generic
  apikey: 'API key',
  mock: 'mock',
};

function formatExpiry(iso: string): string {
  const exp = Date.parse(iso);
  if (!Number.isFinite(exp)) return '';
  const ms = exp - Date.now();
  if (ms <= 0) return 'expired';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function expiryClass(iso: string): 'ok' | 'soon' | 'expired' {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'expired';
  if (ms < 60 * 60 * 1000) return 'soon';
  return 'ok';
}

export function AdapterRow({ adapter: a, onClick, inUse }: Props) {
  const status: 'active' | 'maybe' | 'inactive' =
    a.installed && a.authenticated === true
      ? 'active'
      : a.installed && a.authenticated !== false
        ? 'maybe'
        : 'inactive';

  const dotColor =
    status === 'active'
      ? 'var(--lime)'
      : status === 'maybe'
        ? 'var(--warn)'
        : 'var(--ink-tertiary)';

  const pillText =
    a.installed && a.authenticated === true ? 'auth ✓' : a.installed ? 'installed' : 'missing';

  const planLabel = a.plan ? (PLAN_LABEL[a.plan] ?? a.plan) : null;
  const expiryStr = a.login_expires_at ? formatExpiry(a.login_expires_at) : null;
  const expiryTone = a.login_expires_at ? expiryClass(a.login_expires_at) : null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--r-sm)',
        cursor: onClick ? 'pointer' : 'default',
        background: inUse ? 'var(--surface-2)' : 'transparent',
        borderLeft: inUse ? '2px solid var(--lime)' : '2px solid transparent',
        opacity: status === 'inactive' ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flex: '0 0 auto',
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.display_name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--ink-subtle)',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.version ?? a.models?.[0] ?? ''}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        {planLabel && a.authenticated === true && (
          <span
            title={`plan: ${a.plan}${a.email ? ` · ${a.email}` : ''}${a.auth_source ? ` · src: ${a.auth_source}` : ''}`}
            style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              padding: '1px 5px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--surface-2)',
              color: 'var(--ink-subtle)',
              border: '1px solid var(--hairline)',
              whiteSpace: 'nowrap',
            }}
          >
            {planLabel}
          </span>
        )}
        {expiryStr && a.authenticated === true && (
          <span
            title={`login expires ${a.login_expires_at}`}
            style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              padding: '1px 5px',
              borderRadius: 'var(--r-pill)',
              background:
                expiryTone === 'expired'
                  ? 'rgba(184,67,28,0.14)'
                  : expiryTone === 'soon'
                    ? 'rgba(196,112,32,0.14)'
                    : 'var(--surface-2)',
              color:
                expiryTone === 'expired'
                  ? 'var(--audit-fg)'
                  : expiryTone === 'soon'
                    ? 'var(--warn)'
                    : 'var(--ink-subtle)',
              border: '1px solid var(--hairline)',
              whiteSpace: 'nowrap',
            }}
          >
            {expiryStr}
          </span>
        )}
        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            padding: '1px 6px',
            borderRadius: 'var(--r-pill)',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
            background:
              status === 'active'
                ? 'rgba(107,140,42,0.14)'
                : status === 'maybe'
                  ? 'rgba(196,112,32,0.16)'
                  : 'var(--surface-2)',
            color:
              status === 'active'
                ? 'var(--lime)'
                : status === 'maybe'
                  ? 'var(--warn)'
                  : 'var(--ink-tertiary)',
          }}
        >
          {pillText}
        </span>
      </div>
    </div>
  );
}
