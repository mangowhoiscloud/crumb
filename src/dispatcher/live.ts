/**
 * Live dispatcher — executes effects emitted by the reducer.
 * Spawn effects start a subprocess via the adapter registry.
 * Append effects flow back through the TranscriptWriter.
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { Effect, SpawnEffect } from '../effects/types.js';
import type { Actor } from '../protocol/types.js';
import type { TranscriptWriter } from '../transcript/writer.js';
import type { AdapterRegistry } from '../adapters/types.js';
import { runQaCheckEffect } from './qa-runner.js';
import type { Harness, PresetSpec } from './preset-loader.js';

/**
 * v3.2 budget guardrail (autoresearch P3): an individual spawn cannot run
 * longer than this. The dispatcher AbortController fires SIGTERM via the
 * adapter's signal handler and the spawn is recorded as kind=error so the
 * reducer's circuit_breaker trips. Wiki: bagelcode-budget-guardrails.md
 * §"per_spawn_timeout".
 */
const PER_SPAWN_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

export interface DispatcherDeps {
  writer: TranscriptWriter;
  registry: AdapterRegistry;
  sessionId: string;
  sessionDir: string;
  transcriptPath: string;
  /** Path to repo root — used to resolve agents/<actor>.md sandwiches. */
  repoRoot: string;
  /**
   * Optional preset binding. When present, preset.actors[<actor>] overrides both
   * `effect.adapter` (via harness→adapter mapping) and the default sandwich path.
   * Actors not declared in the preset fall back to `effect.adapter` + ACTOR_TO_SANDWICH.
   */
  preset?: PresetSpec;
  /**
   * Per-harness enabled flag from .crumb/config.toml [providers.*].
   * When binding.harness maps to a disabled provider, dispatcher falls back to
   * builder-fallback adapter (claude-local) and emits kind=note explaining the substitution.
   */
  providersEnabled?: Record<string, boolean>;
  /** Bridge: hook effects surface as user prompts (TUI/CLI). */
  onHook?: (kind: string, body: string, data?: Record<string, unknown>) => Promise<void>;
  /**
   * Per-spawn timeout override (ms). Defaults to PER_SPAWN_TIMEOUT_MS (5 min).
   * Tests pass small values (e.g. 50ms) to exercise the abort path without
   * waiting for the production budget.
   */
  perSpawnTimeoutMs?: number;
}

const ACTOR_TO_SANDWICH: Partial<Record<Actor, string>> = {
  'planner-lead': 'agents/planner-lead.md',
  builder: 'agents/builder.md',
  verifier: 'agents/verifier.md',
  'builder-fallback': 'agents/builder-fallback.md',
  coordinator: 'agents/coordinator.md',
  // v3.4 fix: missing researcher entry caused baseSandwichPath to fall back
  // to '' → resolve(repoRoot, '') = repoRoot (a directory) → readFile threw
  // EISDIR when the no-video researcher path routed through claude-local.
  // Stack trace from session 01KQMGNW: assembleSandwich → readFileHandle EISDIR.
  researcher: 'agents/researcher.md',
};

/** Harness → adapter id mapping for preset bindings. v3.3 added gemini-sdk for the researcher actor (Gemini 3.1 Pro native YouTube URL + 10fps frame sampling — gemini-cli has p1-unresolved video bugs). */
const HARNESS_TO_ADAPTER: Record<Harness, string> = {
  'claude-code': 'claude-local',
  codex: 'codex-local',
  'gemini-cli': 'gemini-local',
  'gemini-sdk': 'gemini-sdk',
  'anthropic-sdk': 'claude-local',
  'openai-sdk': 'codex-local',
  'google-sdk': 'gemini-local',
  mock: 'mock',
  none: 'mock',
};

export async function dispatch(effect: Effect, deps: DispatcherDeps): Promise<void> {
  switch (effect.type) {
    case 'spawn': {
      // Preset binding: when the user has declared this actor in the active preset,
      // use the binding's sandwich + harness→adapter. Otherwise fall back to the
      // reducer-supplied effect.adapter and the default ACTOR_TO_SANDWICH mapping.
      const binding = deps.preset?.actors[effect.actor];
      let adapterId = binding
        ? (HARNESS_TO_ADAPTER[binding.harness] ?? effect.adapter)
        : effect.adapter;
      // Provider-activation gate (.crumb/config.toml [providers.*]):
      // if binding's harness has been disabled by the user, substitute claude-local
      // (the universal fallback) and emit kind=note so observers see the swap.
      if (binding && deps.providersEnabled && deps.providersEnabled[binding.harness] === false) {
        await deps.writer.append({
          session_id: deps.sessionId,
          from: 'system',
          kind: 'note',
          body: `provider ${binding.harness} is disabled in .crumb/config.toml — substituting claude-local for actor ${effect.actor}`,
          metadata: { deterministic: true, tool: 'provider-activation-gate@v1' },
        });
        adapterId = 'claude-local';
      }
      const baseSandwichPath = effect.sandwich_path
        ? resolve(deps.repoRoot, effect.sandwich_path)
        : binding?.sandwich
          ? resolve(deps.repoRoot, binding.sandwich)
          : resolve(deps.repoRoot, ACTOR_TO_SANDWICH[effect.actor] ?? '');
      // v3.2 G4 — sandwich override pipeline:
      //   base agents/<actor>.md
      //   + agents/<actor>.local.md (per-machine, gitignored)
      //   + effect.sandwich_appends (runtime user.intervene with data.sandwich_append)
      // → sessions/<id>/agent-workspace/<actor>/sandwich.assembled.md
      // The assembled file becomes the adapter's --append-system-prompt source so
      // observers can inspect exactly what each spawn saw.
      // G-C — length bias firewall (verifier-only). Inject artifact byte/token
      // counts so the LLM judge has explicit length context and is reminded
      // that length is not a quality signal. Frontier backing:
      //   - AlpacaEval LC (Dubois 2024) → +4.7%/100 tokens at content-equal
      //   - RewardBench v2 (Lambert AI2 2025 §Focus) → length-controlled split
      //     5-12 pt drop in SOTA reward models
      //   - Judge-Bench (Krumdick EMNLP 2025) → Sonnet 4 +1.6 ~ Gemini 2.5 Pro
      //     +3.4% inflated win-rate per length-extended response (residual after
      //     2024-era debiasing)
      //   - Anthropic Hybrid Normalization 2026 (dev docs Q1) → token count
      //     disclosure + "ignore length" → ~50% effect reduction
      //   - Rubric-Anchored Judging (NeurIPS 2025) → length bias concentrates
      //     in qualitative dims (D1 spec_fit / D5 quality) while quantitative
      //     dims (D2/D6 from qa-check-effect) are immune. Hence: D1/D5 scope.
      // Wiki: [[bagelcode-scoring-ratchet-frontier-2026-05-02]] §6 G-C.
      const lengthAppends =
        effect.actor === 'verifier' ? await buildLengthContextAppends(deps.sessionDir) : [];
      const sandwichPath = await assembleSandwich({
        baseSandwichPath,
        appends: [...lengthAppends, ...(effect.sandwich_appends ?? [])],
        sessionDir: deps.sessionDir,
        actor: effect.actor,
        repoRoot: deps.repoRoot,
      });
      const adapter = deps.registry.get(adapterId);

      // v3.3+ observability — record dispatcher's intent BEFORE invoking adapter.
      // Lets us distinguish "dispatcher never reached spawn" from "adapter ran but
      // produced no output". Marked private + deterministic so anti-deception/
      // verifier ignore it but `crumb debug` can read it.
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'system',
        kind: 'note',
        body: `dispatch.spawn → actor=${effect.actor} adapter=${adapterId} sandwich=${sandwichPath}`,
        data: {
          actor: effect.actor,
          adapter: adapterId,
          sandwich_path: sandwichPath,
          has_prompt: Boolean(effect.prompt && effect.prompt.length > 0),
        },
        metadata: {
          visibility: 'private',
          deterministic: true,
          tool: 'dispatch-pre-spawn@v1',
        },
      });

      // v3.2 per_spawn_timeout: AbortController fires SIGTERM via the adapter's
      // signal handler. The Promise.race pattern is unnecessary here — the
      // adapter's own close handler resolves once SIGTERM lands, and we read
      // controller.signal.aborted to distinguish a timed-out spawn from a
      // genuine adapter error.
      const controller = new AbortController();
      const timeoutMs = deps.perSpawnTimeoutMs ?? PER_SPAWN_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      // Don't keep the event loop alive on the timer alone.
      timer.unref?.();

      let result;
      try {
        result = await adapter.spawn({
          actor: effect.actor,
          sessionId: deps.sessionId,
          sessionDir: deps.sessionDir,
          sandwichPath,
          transcriptPath: deps.transcriptPath,
          prompt: effect.prompt,
          // Pass binding's model + effort through to adapters that support them.
          // codex-local consumes both (--model + -c model_reasoning_effort=...);
          // claude-local / gemini-local accept the fields but cannot pass them
          // to the underlying CLI (API-only) — informational only.
          model: binding?.model,
          effort: binding?.effort,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const timedOut = controller.signal.aborted;

      // v3.4 ArgoCD-style logs — persist full stdout / stderr to disk under
      // <session>/agent-workspace/<actor>/spawn-<ts>.log so the dashboard's
      // log viewer can tail it. The transcript-side `kind=note` summary
      // remains a 4KB preview; the full stream lives on disk and is offered
      // via the dashboard's GET /api/sessions/:id/logs/:actor stream + snapshot
      // endpoints. Best-effort: a write failure must NOT break the spawn.
      const logTs = new Date().toISOString().replace(/[:.]/g, '-');
      const logPath = resolve(
        deps.sessionDir,
        'agent-workspace',
        effect.actor,
        `spawn-${logTs}.log`,
      );
      try {
        await mkdir(resolve(deps.sessionDir, 'agent-workspace', effect.actor), {
          recursive: true,
        });
        const logBody =
          `=== adapter ${adapterId} spawn @ ${new Date().toISOString()} ` +
          `(exit=${result.exitCode}, ${result.durationMs}ms${timedOut ? ', timed out' : ''}) ===\n\n` +
          `--- stdout ---\n${result.stdout ?? ''}\n\n--- stderr ---\n${result.stderr ?? ''}\n`;
        await writeFile(logPath, logBody, 'utf8');
      } catch {
        // log persistence is observability-only — keep the dispatcher silent
        // on disk failure so the spawn lifecycle isn't disrupted.
      }

      // v3.3+ observability — always capture truncated stdout/stderr as
      // kind=note so an exit-0-but-silent spawn (planner-lead emits no
      // transcript events) is still diagnosable. Without this, exit=0 with
      // empty stdout looks identical to exit=0 with a successful run.
      // Marked visibility=private + deterministic so verifiers/anti-deception
      // ignore it, but observers + `crumb debug` can read it.
      const stdoutPreview = (result.stdout ?? '').slice(0, 4000);
      const stderrPreview = (result.stderr ?? '').slice(0, 4000);
      if (stdoutPreview.length > 0 || stderrPreview.length > 0) {
        await deps.writer.append({
          session_id: deps.sessionId,
          from: effect.actor,
          kind: 'note',
          body: `adapter ${adapterId} streams (exit=${result.exitCode}, ${result.durationMs}ms)`,
          data: {
            adapter: adapterId,
            stdout_truncated: stdoutPreview,
            stderr_truncated: stderrPreview,
            stdout_full_length: result.stdout?.length ?? 0,
            stderr_full_length: result.stderr?.length ?? 0,
          },
          metadata: {
            visibility: 'private',
            deterministic: true,
            tool: `${adapterId}-stream@v1`,
          },
        });
      }

      // Surface non-zero exit as kind=error so the reducer can trip the breaker.
      // Timeout is a special case: clearer body + structured data so observers
      // and the verifier can distinguish stalled spawn from genuine CLI failure.
      if (result.exitCode !== 0 || timedOut) {
        await deps.writer.append({
          session_id: deps.sessionId,
          from: effect.actor,
          kind: 'error',
          body: timedOut
            ? `per_spawn_timeout: adapter ${adapterId} exceeded ${timeoutMs}ms (SIGTERM sent)`
            : `adapter ${adapterId} exited ${result.exitCode}`,
          data: timedOut
            ? {
                reason: 'per_spawn_timeout',
                timeout_ms: timeoutMs,
                exit_code: result.exitCode,
                stderr: result.stderr.slice(0, 2000),
              }
            : { stderr: result.stderr.slice(0, 2000) },
        });
      }
      // Always append agent.stop so observers know the turn ended.
      // v3.3 — token usage / cost / model from the adapter's parsed output
      // (Anthropic stream-json `result` event, OpenAI Codex `usage`, etc.)
      // get folded into metadata here so the dashboard surfaces real numbers
      // instead of zeros. Adapters that can't recover usage (text mode / mock)
      // simply omit the field.
      const usage = result.usage ?? {};
      const stopMetadata: Record<string, unknown> = { latency_ms: result.durationMs };
      if (typeof usage.tokens_in === 'number') stopMetadata.tokens_in = usage.tokens_in;
      if (typeof usage.tokens_out === 'number') stopMetadata.tokens_out = usage.tokens_out;
      if (typeof usage.cache_read === 'number') stopMetadata.cache_read = usage.cache_read;
      if (typeof usage.cache_write === 'number') stopMetadata.cache_write = usage.cache_write;
      if (typeof usage.cost_usd === 'number') stopMetadata.cost_usd = usage.cost_usd;
      if (typeof usage.model === 'string') stopMetadata.model = usage.model;
      await deps.writer.append({
        session_id: deps.sessionId,
        from: effect.actor,
        kind: 'agent.stop',
        body: `${effect.actor} stopped (exit=${result.exitCode}, ${result.durationMs}ms${
          timedOut ? ', timed out' : ''
        })`,
        metadata: stopMetadata,
      });
      break;
    }
    case 'append': {
      await deps.writer.append({
        ...effect.message,
        session_id: effect.message.session_id ?? deps.sessionId,
      });
      break;
    }
    case 'hook': {
      if (deps.onHook) await deps.onHook(effect.kind, effect.body, effect.data);
      else {
        // eslint-disable-next-line no-console
        console.log(`[hook ${effect.kind}] ${effect.body}`);
      }
      break;
    }
    case 'rollback': {
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'coordinator',
        kind: 'handoff.rollback',
        to: effect.to,
        body: effect.feedback,
      });
      // Rollback also implies respawn on the target — caller will route the next
      // event through the reducer to pick that up.
      break;
    }
    case 'stop': {
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'coordinator',
        kind: 'agent.stop',
        body: `coordinator-initiated stop: ${effect.reason}`,
      });
      break;
    }
    case 'done': {
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'coordinator',
        kind: 'done',
        body: effect.reason,
      });
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'coordinator',
        kind: 'session.end',
        body: `session terminated: ${effect.reason}`,
      });
      break;
    }
    case 'qa_check': {
      // v3: deterministic ground-truth check (no LLM). Emits kind=qa.result.
      // See [[bagelcode-system-architecture-v3]] §3.5, §7 (3-layer scoring).
      await runQaCheckEffect(effect, {
        writer: deps.writer,
        sessionId: deps.sessionId,
        sessionDir: deps.sessionDir,
      });
      break;
    }
  }
}

/** v3.4 G-C — length-bias firewall artifacts the verifier consumes. The byte
 * counts come from the on-disk artifact files; token counts use the standard
 * 4-byte heuristic (good enough for length-context disclosure — the LLM only
 * needs an order-of-magnitude signal that "this doc is N tokens, not 4N").
 *
 * D2/D6 are deterministic (qa-check-effect ground truth) and immune to length
 * bias per Rubric-Anchored Judging (NeurIPS 2025). The firewall therefore
 * scopes to D1/D5 — the LLM-judged dims where length confound concentrates.
 */
const LENGTH_CONTEXT_ARTIFACTS = ['spec.md', 'DESIGN.md', 'tuning.json', 'game.html'] as const;

export async function buildLengthContextAppends(
  sessionDir: string,
): Promise<{ source_id: string; text: string }[]> {
  const artifactsDir = resolve(sessionDir, 'artifacts');
  const lines: string[] = [];
  for (const name of LENGTH_CONTEXT_ARTIFACTS) {
    const path = resolve(artifactsDir, name);
    if (!existsSync(path)) continue;
    const stat = await import('node:fs/promises').then((m) => m.stat(path));
    const bytes = stat.size;
    const tokens = Math.ceil(bytes / 4); // 4-byte heuristic, see fn header
    lines.push(`- ${name}: ${bytes}B (~${tokens} tokens)`);
  }
  if (lines.length === 0) return [];
  const text = [
    '## Artifact length context (G-C — do NOT use as a quality signal)',
    '',
    'Sizes of the artifacts you are about to evaluate:',
    ...lines,
    '',
    '**Reminder**: length is not quality. Frontier judges (Sonnet 4, GPT-5,',
    'Gemini 2.5 Pro, Opus 4) still show +1.6 ~ +3.4% win-rate inflation per',
    'length-extended response at content-equal (Krumdick EMNLP 2025).',
    'Score D1 (spec_fit) and D5 (quality) on AC compliance and design intent,',
    'not on prose volume. Length-controlled scoring is the 2025-2026 frontier',
    'standard (Arena-Hard v2 default; AlpacaEval LC 2024).',
  ].join('\n');
  return [{ source_id: 'system:length-context@v1', text }];
}

interface AssembleArgs {
  baseSandwichPath: string;
  appends: NonNullable<SpawnEffect['sandwich_appends']>;
  sessionDir: string;
  actor: Actor;
  /** Repo root for resolving agents/_event-protocol.md (v3.3+ injection). */
  repoRoot: string;
}

/** Actors that emit transcript events via the `crumb event` CLI helper. */
const EMITTING_ACTORS: ReadonlySet<Actor> = new Set([
  'planner-lead',
  'builder',
  'verifier',
  'builder-fallback',
  'researcher',
]);

/**
 * v3.2 G4 — assemble per-spawn sandwich from base + per-machine local override
 * + runtime sandwich_appends.
 *
 * v3.3+ — also injects `agents/_event-protocol.md` for any actor that emits
 * transcript events. The standalone protocol file documents the `crumb event`
 * Bash heredoc pattern; without inlining it into the sandwich, Claude/Codex
 * tend to PRINT JSON to stdout instead of invoking the CLI (observed: run
 * 01KQMCSC, planner-lead exit 0 in 41s with stdout containing valid JSON
 * blocks but zero transcript events). Verifier + coordinator already had
 * 1-line mentions of `crumb event`; planner-lead / builder / builder-fallback
 * / researcher had zero. This fix makes the protocol always available.
 *
 * Writes the result under the session's agent-workspace so observers / replay
 * can audit exactly what each spawn saw.
 */
async function assembleSandwich(args: AssembleArgs): Promise<string> {
  const { baseSandwichPath, appends, sessionDir, actor, repoRoot } = args;
  const localPath = baseSandwichPath.replace(/\.md$/, '.local.md');
  const eventProtocolPath = resolve(repoRoot, 'agents', '_event-protocol.md');
  const hasBase = baseSandwichPath !== '' && existsSync(baseSandwichPath);
  const hasLocal = baseSandwichPath !== '' && existsSync(localPath);
  const needsEventProtocol = EMITTING_ACTORS.has(actor) && existsSync(eventProtocolPath);
  // Skip assembly only when nothing additive applies (no local override, no
  // runtime appends, and this actor doesn't need the event protocol injection).
  if (!hasLocal && appends.length === 0 && !needsEventProtocol) {
    return baseSandwichPath;
  }
  const parts: string[] = [];
  if (hasBase) {
    parts.push(await readFile(baseSandwichPath, 'utf-8'));
  }
  if (needsEventProtocol) {
    const protocol = await readFile(eventProtocolPath, 'utf-8');
    parts.push(
      `<!-- begin event protocol (agents/_event-protocol.md) -->\n${protocol}\n<!-- end event protocol -->`,
    );
  }
  if (hasLocal) {
    const localContent = await readFile(localPath, 'utf-8');
    parts.push(
      `<!-- begin local override (${localPath}) -->\n${localContent}\n<!-- end local override -->`,
    );
  }
  for (const a of appends) {
    parts.push(
      `<!-- begin sandwich_append source=${a.source_id} -->\n${a.text}\n<!-- end sandwich_append -->`,
    );
  }
  const outDir = resolve(sessionDir, 'agent-workspace', actor);
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'sandwich.assembled.md');
  await writeFile(outPath, parts.join('\n\n') + '\n', 'utf-8');
  return outPath;
}
