/**
 * Crumb MCP Server — single source-of-truth tool registry shared across 3 hosts.
 *
 * Exposes 8 helpers as MCP tools so Claude Code / Codex CLI / Gemini CLI pick
 * them up via natural-language matching against `description` fields.
 *
 * Naming: brand-forward `crumb_<verb>` mirroring the CLI subcommand 1:1
 * (precedent: OpenAI Codex CLI exposes its MCP tool as `codex` / `codex-reply`,
 * server-name == tool-name). One vocabulary across CLI + MCP — no drift.
 *
 *   crumb_config   ↔ `crumb config <intent>`            preset 추천
 *   crumb_status   ↔ `crumb status <session>`           recent events + scores
 *   crumb_explain  ↔ `crumb explain <kind>`             39 kind schema lookup
 *   crumb_suggest  ↔ `crumb suggest <session>`          next user action
 *   crumb_debug    ↔ `crumb debug <session>`            F1-F7 fault matrix
 *   crumb_doctor   ↔ `crumb doctor`                     env readiness
 *   crumb_export   ↔ `crumb export <session> --format`  otel/anthropic/chrome trace
 *
 * Tool descriptions encode KO+EN trigger phrases ("preset 추천", "어떤 셋업이
 * 좋을까", "recommend a preset") so the host model semantically routes natural
 * language to the right tool. All tools are READ-ONLY — safe to auto-invoke.
 *
 * Wire-up:
 *   .mcp.json (Claude Code project root)
 *   .codex/agents/crumb.toml [mcp_servers.crumb]
 *   .gemini/extensions/crumb/gemini-extension.json mcpServers
 *
 * See [[bagelcode-system-architecture-v0.1]] §2 (4 entry path) + §12 (5 helper).
 */

import { resolve } from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { reduce } from './reducer/index.js';
import { initialState } from './state/types.js';
import { resolveSessionDir as resolveStoredSession } from './paths.js';
import { readAll } from './transcript/reader.js';
import { recommendPreset, formatRecommendation } from './helpers/config.js';
import { computeStatus, formatStatus } from './helpers/status.js';
import { explainKind, formatExplain } from './helpers/explain.js';
import { suggestNext, formatSuggestion } from './helpers/suggest.js';
import { diagnose, formatDiagnosis } from './helpers/debug.js';
import { runDoctor, formatReport } from './helpers/doctor.js';
import { serialize as serializeExport } from './exporter/otel.js';
import { registerWriteTools } from './mcp-write-tools.js';

const VERSION = '0.2.0';

async function loadSession(target: string, root: string) {
  // v0.3.0: resolveStoredSession checks ~/.crumb/projects/<id>/sessions/<ulid>/ first,
  // falls back to legacy <cwd>/sessions/<ulid>/ until migration.
  const sessionDir = await resolveStoredSession(target, root);
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  const events = await readAll(transcriptPath);
  let state = initialState(events[0]?.session_id ?? 'unknown');
  for (const e of events) state = reduce(state, e).state;
  return { sessionDir, transcriptPath, events, state };
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

export function buildServer(root: string = process.cwd()): McpServer {
  const server = new McpServer({
    name: 'crumb',
    version: VERSION,
  });

  // ─── Tool 1 — preset recommendation (NL trigger source-of-truth) ────────
  server.registerTool(
    'crumb_config',
    {
      title: 'Recommend a Crumb preset',
      description:
        'Recommend a Crumb preset (bagelcode-cross-3way / mock / sdk-enterprise / solo) based on the user\'s natural-language hint. Use when the user asks "preset 추천해줘", "추천", "어떤 셋업", "which preset", "suggest a config", "혼자 돌릴까", "Codex 같이 쓸까", or hints about installed tools / API keys / cross-provider intent. Crumb suggests only — the user picks; never forces a default.',
      inputSchema: {
        intent: z
          .string()
          .describe('Natural-language hint about the desired setup (Korean or English).'),
        project_root: z.string().optional().describe('Repo root (defaults to server cwd).'),
      },
    },
    async ({ intent, project_root }) => {
      const rec = recommendPreset(intent, project_root ?? root);
      return textResult(formatRecommendation(rec));
    },
  );

  // ─── Tool 2 — session status (recent events + scores + cost) ────────────
  server.registerTool(
    'crumb_status',
    {
      title: 'Show Crumb session status',
      description:
        'Show the current status of a running Crumb session: last 10 signal events (goal/spec/build/qa.result/judge.score/...), latest D1-D6 scorecard with source-of-truth, total cost / cache hit / wall time, stuck count. Use when the user asks "지금 어디까지 갔어?", "상황 어때?", "status", "session progress", "어떻게 진행 중?", "점수가 얼마야?", or wants a snapshot of an active session.',
      inputSchema: {
        session: z.string().describe('Session ULID or path to sessions/<id>/.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Recent events to show (default 10).'),
      },
    },
    async ({ session, limit }) => {
      try {
        const { events, state } = await loadSession(session, root);
        return textResult(formatStatus(computeStatus(events, state, limit ?? 10)));
      } catch (e) {
        return errorResult(
          `Failed to load session ${session}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

  // ─── Tool 3 — explain transcript schema kind ────────────────────────────
  server.registerTool(
    'crumb_explain',
    {
      title: 'Explain a Crumb transcript kind',
      description:
        'Explain a Crumb transcript event kind (e.g. qa.result, judge.score, step.judge, user.intervene). Returns: category, emitter, parent chain, payload shape, source-of-truth (D1-D6), and wiki spec reference. Use when the user asks "judge.score 가 뭐야?", "qa.result 는 뭔가요?", "what is X kind", "explain <kind>", "이 kind 어디 emit?", or wants to understand schema vocabulary.',
      inputSchema: {
        kind: z.string().describe('A kind name from the transcript schema (e.g. "qa.result").'),
      },
    },
    async ({ kind }) => {
      return textResult(formatExplain(explainKind(kind)));
    },
  );

  // ─── Tool 4 — suggest next user action ──────────────────────────────────
  server.registerTool(
    'crumb_suggest',
    {
      title: 'Suggest next user action',
      description:
        'Recommend what the user should do next in a Crumb session: /approve, /veto, /redo, /pause, wait, or open summary. Branches on last event + verdict + audit + stuck_count. Use when the user asks "이제 뭐 하지?", "다음에 뭐 할까?", "what next", "next action", "다음 단계", "이거 끝난 거야?", or seems unsure about how to proceed.',
      inputSchema: {
        session: z.string().describe('Session ULID or path.'),
      },
    },
    async ({ session }) => {
      try {
        const { events, state } = await loadSession(session, root);
        return textResult(formatSuggestion(suggestNext(events, state)));
      } catch (e) {
        return errorResult(
          `Failed to load session ${session}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

  // ─── Tool 5 — diagnose F1-F7 routing faults ─────────────────────────────
  server.registerTool(
    'crumb_debug',
    {
      title: 'Diagnose Crumb routing faults (F1-F7)',
      description:
        'Diagnose routing faults in a Crumb session against the F1-F7 fault matrix (adapter spawn / subprocess timeout / schema fail / qa.result missing / self-bias / infinite loop / env not propagated). Use when the user asks "왜 멈췄어?", "에러 났어?", "왜 안 돼?", "session stuck", "어디서 막혔어?", "debug", "fault", or session shows signs of trouble (no progress / repeated kinds / error events).',
      inputSchema: {
        session: z.string().describe('Session ULID or path.'),
      },
    },
    async ({ session }) => {
      try {
        const { events, state } = await loadSession(session, root);
        return textResult(formatDiagnosis(diagnose(events, state)));
      } catch (e) {
        return errorResult(
          `Failed to load session ${session}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

  // ─── Tool 6 — doctor environment check ──────────────────────────────────
  server.registerTool(
    'crumb_doctor',
    {
      title: 'Crumb environment readiness check',
      description:
        'Check whether the host environment can run Crumb: 3 host CLI authentication (Claude Code / Codex / Gemini CLI), playwright availability, htmlhint fallback. Returns a viable-preset recommendation table. Use when the user asks "환경 점검해줘", "doctor", "어떤 preset 가능?", "preset 가능한 거 알려줘", "is my setup ready?", "what can I run?", or before starting a fresh session.',
    },
    async () => {
      return textResult(formatReport(await runDoctor()));
    },
  );

  // ─── Tool 7 — model + provider config (NL-editable) ─────────────────────
  server.registerTool(
    'crumb_model',
    {
      title: 'Edit Crumb model + provider config',
      description:
        'Show or change Crumb per-actor model, effort (low/med/high), or per-provider activation (claude-local / codex-local / gemini-cli-local). Provide a natural-language instruction to apply a change, or omit to just show current config. Use when the user asks "verifier 모델을 X 로", "effort 다 high 로", "codex 비활성화", "set builder model to Y", "disable gemini", "어떤 모델 쓰고 있어?", "show model config", or any per-actor / per-provider tuning request. Defaults to all high-end models (claude-opus-4-7 / gpt-5.5-codex / gemini-3-1-pro) + effort=high. Gemini IDs accept both dot ("gemini-3.1-pro") and dash ("gemini-3-1-pro") forms.',
      inputSchema: {
        instruction: z
          .string()
          .optional()
          .describe(
            'Natural-language instruction (Korean or English). Omit to just show current config.',
          ),
      },
    },
    async ({ instruction }) => {
      const { applyNlInstruction, showConfig } = await import('./tui/model-edit.js');
      if (!instruction || instruction.trim().length === 0) {
        return textResult(showConfig(root));
      }
      return textResult(applyNlInstruction(root, instruction));
    },
  );

  // ─── Tool 8 — export transcript to OTel / Anthropic / Chrome trace ──────
  server.registerTool(
    'crumb_export',
    {
      title: 'Export Crumb transcript to standard formats',
      description:
        'Export a Crumb session transcript to OpenTelemetry GenAI Semantic Conventions JSONL, Anthropic Console import JSON, or chrome://tracing format. Use when the user asks "OTel 로 변환", "datadog 으로", "Vertex 로", "trace export", "convert to OTel", or wants to ship the transcript to an external observability platform.',
      inputSchema: {
        session: z.string().describe('Session ULID or path.'),
        format: z
          .enum(['otel-jsonl', 'anthropic-trace', 'chrome-trace'])
          .describe(
            'Export format. otel-jsonl = OpenTelemetry GenAI; anthropic-trace = Claude Console; chrome-trace = chrome://tracing.',
          ),
      },
    },
    async ({ session, format }) => {
      try {
        const { events } = await loadSession(session, root);
        const text = serializeExport(format, events);
        return textResult(text || '(empty transcript)');
      } catch (e) {
        return errorResult(
          `Failed to export session ${session}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

  registerWriteTools(server, root);

  return server;
}

export async function runMcpServer(): Promise<void> {
  const server = buildServer(process.cwd());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMcpServer().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[crumb-mcp] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
