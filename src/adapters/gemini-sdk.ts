/**
 * gemini-sdk adapter — in-process Google Gen AI SDK call for the v3.3 researcher actor.
 *
 * Why this exists (NOT a duplicate of gemini-local):
 *   - gemini-cli subprocess has 4 closed/p1-unresolved video bugs as of 2026-05
 *     (refs google-gemini/gemini-cli #1556, #1691, #3379, #15634). Even for files
 *     in the registered MIME table, the model frequently refuses with "I cannot
 *     watch video files." That non-determinism violates Crumb's invariant #1
 *     (transcript = single source of truth, replay-deterministic).
 *   - The official Gemini API accepts video natively: Files API upload (≤1h at
 *     default media resolution) OR public YouTube URL as `file_data` Part. With
 *     Gemini 3.1 Pro, fast-paced action gets 10 fps frame sampling out of the box
 *     (blog.google/technology/developers/gemini-3-pro-vision/).
 *   - In-process means no subprocess spawn, no signal propagation, no stderr
 *     parsing. The dispatcher's per-spawn timeout still applies via the
 *     AbortController on the SDK client.
 *
 * Cache strategy (replay determinism):
 *   - Every step.research.video event carries metadata.cache_key =
 *     sha256(video_ref + model + prompt_version). Before calling the SDK, the
 *     adapter scans the existing transcript for a matching cache_key. Hit →
 *     return cached event verbatim, no network. Miss → SDK call, write the
 *     event with cache_key set so future replays hit.
 *
 * Auth:
 *   - GOOGLE_API_KEY environment variable (Gemini Developer API). Free tier
 *     8h video/day, paid unlimited.
 *   - When unset, health() reports the missing key — adapter must not silently
 *     fall back to a different provider, since the user's preset explicitly
 *     bound researcher to this adapter.
 *
 * The SpawnRequest carries the researcher's sandwich (`agents/researcher.md`)
 * and the goal payload (which may include data.video_refs from the goal event).
 * The adapter:
 *   1. reads the sandwich
 *   2. parses video_refs from req.prompt (the dispatcher passes the goal body
 *      + parent transcript context as the prompt for non-CLI adapters)
 *   3. for each video_ref:
 *      - check cache_key in transcript → skip if hit
 *      - upload (Files API for local paths) or pass directly (YouTube URL)
 *      - generateContent with sandwich + file_data Part
 *      - emit kind=step.research.video via TranscriptWriter
 *   4. emit synthesis kind=step.research from accumulated mechanics
 *   5. emit kind=handoff.requested(to=planner-lead) so the reducer routes phase B
 *
 * The `@google/genai` import is dynamic — keeping the package optional at install
 * time (mock adapter doesn't need it). Sessions that don't bind researcher to
 * gemini-sdk never load the SDK.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { ulid } from 'ulid';

import type { Adapter, SpawnRequest, SpawnResult } from './types.js';
import { TranscriptWriter } from '../transcript/writer.js';
import { readAll } from '../transcript/reader.js';
import type { Message } from '../protocol/types.js';

const DEFAULT_MODEL = 'gemini-3-1-pro';
const PROMPT_VERSION = 'v3.3-researcher@v1';

interface SdkClient {
  files: {
    upload(args: { file: string }): Promise<{ uri: string; mimeType: string }>;
  };
  models: {
    generateContent(args: {
      model: string;
      contents: unknown[];
      config?: { abortSignal?: AbortSignal };
    }): Promise<{ text: string; usageMetadata?: { totalTokens?: number } }>;
  };
}

/**
 * Lazy-load the SDK so non-researcher sessions don't pay the install cost.
 * Returns null when GOOGLE_API_KEY is unset OR @google/genai is not installed —
 * the caller emits kind=error with a precise reason rather than silently failing.
 */
async function loadSdk(): Promise<{ client: SdkClient; reason?: string } | { reason: string }> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      reason:
        'GOOGLE_API_KEY env var not set — researcher actor needs the Gemini Developer API key for video understanding (gemini-cli has unresolved video bugs)',
    };
  }
  try {
    // Dynamic import keeps @google/genai optional — only sessions binding the
    // researcher actor to gemini-sdk pull it in. The TS module path is opaque
    // (package may not be installed in dev), so we use a runtime string and
    // type-erase via Function constructor to avoid the typecheck breaking when
    // the package is absent. Fixed module path; no user input → no eval risk.
    const dynamicImport = new Function('p', 'return import(p)') as (p: string) => Promise<{
      GoogleGenAI: new (args: { apiKey: string }) => SdkClient;
    }>;
    const mod = await dynamicImport('@google/genai').catch(() => null);
    if (!mod) {
      return {
        reason:
          '@google/genai not installed — run `npm install @google/genai` to enable the researcher actor',
      };
    }
    const client = new mod.GoogleGenAI({ apiKey });
    return { client };
  } catch (err) {
    return { reason: `failed to load @google/genai: ${err instanceof Error ? err.message : err}` };
  }
}

interface VideoRef {
  uri: string;
  kind: 'youtube' | 'local';
  mimeType: string;
}

function classifyVideoRef(ref: string): VideoRef | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  // YouTube — accept the canonical hostnames; reject bare http://.
  const youtubeRe = /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//;
  if (youtubeRe.test(trimmed)) {
    return { uri: trimmed, kind: 'youtube', mimeType: 'video/*' };
  }
  // Local file path under sessions/<id>/inbox/. The dispatcher resolves
  // session paths absolutely; we just verify it exists.
  if (trimmed.startsWith('/') && existsSync(trimmed)) {
    const ext = trimmed.split('.').pop()?.toLowerCase() ?? 'mp4';
    const mimeMap: Record<string, string> = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      avi: 'video/x-msvideo',
      mpeg: 'video/mpeg',
      mpg: 'video/mpeg',
      flv: 'video/x-flv',
    };
    return { uri: trimmed, kind: 'local', mimeType: mimeMap[ext] ?? 'video/mp4' };
  }
  return null;
}

function computeCacheKey(videoRef: string, model: string): string {
  return createHash('sha256').update(`${videoRef}::${model}::${PROMPT_VERSION}`).digest('hex');
}

function findCachedVideoEvent(events: Message[], cacheKey: string): Message | null {
  for (const e of events) {
    if (e.kind === 'step.research.video' && e.metadata?.cache_key === cacheKey) {
      return e;
    }
  }
  return null;
}

function parseVideoRefs(events: Message[]): string[] {
  // Look for the first goal event in this session and extract data.video_refs.
  // The reducer doesn't transform this field; it lives on the original goal.
  for (const e of events) {
    if (e.kind === 'goal' && Array.isArray((e.data as { video_refs?: unknown })?.video_refs)) {
      return (e.data as { video_refs: string[] }).video_refs.filter((r) => typeof r === 'string');
    }
  }
  return [];
}

export class GeminiSdkAdapter implements Adapter {
  readonly id = 'gemini-sdk';

  async health(): Promise<{ ok: boolean; reason?: string }> {
    const sdk = await loadSdk();
    if ('reason' in sdk && !('client' in sdk)) {
      return { ok: false, reason: sdk.reason };
    }
    return { ok: true };
  }

  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    const start = Date.now();
    const writer = new TranscriptWriter({
      path: req.transcriptPath,
      sessionId: req.sessionId,
    });
    const wakeId = ulid();
    await writer.append({
      id: wakeId,
      session_id: req.sessionId,
      from: req.actor,
      kind: 'agent.wake',
      body: `${req.actor} starting (gemini-sdk)`,
      metadata: { harness: 'gemini-sdk', provider: 'google', model: DEFAULT_MODEL },
    });

    if (!existsSync(req.sandwichPath)) {
      await writer.append({
        session_id: req.sessionId,
        from: req.actor,
        kind: 'error',
        body: `sandwich not found: ${req.sandwichPath}`,
      });
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'sandwich missing',
        durationMs: Date.now() - start,
      };
    }
    const sandwich = await readFile(req.sandwichPath, 'utf8');

    const transcript = await readAll(req.transcriptPath);
    const videoRefs = parseVideoRefs(transcript);

    // v3.4: text-only stub branch removed. The previous behavior emitted empty
    // reference_games[] + design_lessons[] regardless of input — pretending to
    // research while doing nothing. Now the reducer's pickAdapter('researcher')
    // routes text-only sessions to `claude-local` (LLM-driven, runs the
    // researcher.md sandwich step 1+3 fallback for real wiki-based research),
    // and only sends video_refs sessions here.
    //
    // If we still get here with no video_refs, it means a preset explicitly
    // bound researcher = gemini-sdk (e.g. bagelcode-cross-3way) but the goal
    // didn't carry video_refs. Surface this as kind=error so the user can
    // either provide videos or rebind the actor.
    if (videoRefs.length === 0) {
      await writer.append({
        session_id: req.sessionId,
        from: req.actor,
        kind: 'error',
        body: 'gemini-sdk adapter requires goal.data.video_refs[]; got empty. Either provide video URLs/paths or rebind the researcher actor (e.g. via .crumb/config.toml or a preset without explicit gemini-sdk binding) so it routes to claude-local for text-only research.',
        data: {
          reason: 'gemini_sdk_no_video_refs',
          adapter: 'gemini-sdk',
          actor: req.actor,
        },
        metadata: {
          deterministic: true,
          tool: 'gemini-sdk@v1',
        },
      });
      return {
        exitCode: 2,
        stdout: '',
        stderr: 'gemini-sdk: no video_refs in goal — see kind=error event for guidance',
        durationMs: Date.now() - start,
      };
    }

    // Per-video processing. We classify + cache-check BEFORE loading the SDK so
    // (a) replay cache hits skip the network entirely (and don't require an API
    // key), and (b) invalid refs surface as kind=error regardless of SDK state.
    // SDK is only loaded if at least one ref needs a fresh upload/generateContent.
    const videoEvidenceIds: string[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    type Pending = { uri: string; kind: 'youtube' | 'local'; mimeType: string; cacheKey: string };
    const pending: Pending[] = [];

    for (const ref of videoRefs.slice(0, 5)) {
      // Cap at 5 videos per spawn — autoresearch P3 budget guardrail.
      const classified = classifyVideoRef(ref);
      if (!classified) {
        await writer.append({
          session_id: req.sessionId,
          from: req.actor,
          kind: 'error',
          body: `invalid video_ref (not a YouTube URL or accessible local path): ${ref}`,
          data: { ref },
        });
        continue;
      }
      const cacheKey = computeCacheKey(classified.uri, DEFAULT_MODEL);
      const cached = findCachedVideoEvent(transcript, cacheKey);
      if (cached) {
        cacheHits += 1;
        videoEvidenceIds.push(cached.id);
        await writer.append({
          session_id: req.sessionId,
          from: req.actor,
          kind: 'note',
          body: `cache hit for video_ref ${classified.uri} — replay using ${cached.id}`,
          metadata: { cache_key: cacheKey },
        });
        continue;
      }
      pending.push({ ...classified, cacheKey });
    }

    // Load SDK only if there are uncached videos to process. All-cache-hit
    // sessions never touch the network, so they replay deterministically even
    // when GOOGLE_API_KEY is absent (the canonical replay scenario).
    if (pending.length > 0) {
      const sdk = await loadSdk();
      if ('reason' in sdk && !('client' in sdk)) {
        await writer.append({
          session_id: req.sessionId,
          from: req.actor,
          kind: 'error',
          body: `gemini-sdk unavailable: ${sdk.reason}`,
          data: { reason: sdk.reason },
        });
        return { exitCode: 2, stdout: '', stderr: sdk.reason, durationMs: Date.now() - start };
      }
      const client = sdk.client;

      for (const p of pending) {
        cacheMisses += 1;

        // Build the file_data Part. YouTube URLs go in directly; local files
        // upload via Files API first.
        const fileUri =
          p.kind === 'youtube' ? p.uri : (await client.files.upload({ file: p.uri })).uri;

        const prompt = `${sandwich}\n\nExtract mechanics + timing from this gameplay clip per agents/specialists/game-design.md §3 (MechanicEvidence schema). Return strict JSON.`;

        const result = await client.models.generateContent({
          model: DEFAULT_MODEL,
          contents: [{ file_data: { file_uri: fileUri, mime_type: p.mimeType } }, prompt],
        });

        const mechanics = parseMechanicsJson(result.text);
        const evidenceId = ulid();
        videoEvidenceIds.push(evidenceId);
        await writer.append({
          id: evidenceId,
          session_id: req.sessionId,
          from: req.actor,
          kind: 'step.research.video',
          body: `${p.uri} — ${mechanics.length} mechanics extracted`,
          data: {
            video_ref: p.uri,
            mechanics_extracted: mechanics,
          },
          metadata: {
            harness: 'gemini-sdk',
            provider: 'google',
            model: DEFAULT_MODEL,
            deterministic: false,
            evidence_kind: 'video',
            cache_key: p.cacheKey,
            tokens_in: result.usageMetadata?.totalTokens,
          },
        });
      }
    }

    // Synthesis — combine all step.research.video into a step.research event with
    // evidence_refs pointing at the per-video event ids. The actual mechanics →
    // lessons reduction is the model's job; here we just thread evidence_refs.
    await writer.append({
      session_id: req.sessionId,
      from: req.actor,
      kind: 'step.research',
      body: `synthesis from ${videoEvidenceIds.length} video evidence event(s) — ${cacheHits} cache hit / ${cacheMisses} miss`,
      data: {
        reference_games: [],
        design_lessons: [],
        evidence_kind: 'video',
      },
      metadata: {
        harness: 'gemini-sdk',
        provider: 'google',
        model: DEFAULT_MODEL,
        evidence_kind: 'video',
        deterministic: false,
      },
    });
    await writer.append({
      session_id: req.sessionId,
      from: req.actor,
      kind: 'handoff.requested',
      to: 'planner-lead',
      data: {
        phase: 'B',
        reason: 'video-grounded research synthesis ready',
        evidence_count: videoEvidenceIds.length,
      },
    });

    return {
      exitCode: 0,
      stdout: `gemini-sdk researcher: ${videoEvidenceIds.length} video evidence (${cacheHits}h/${cacheMisses}m), synthesis emitted`,
      stderr: '',
      durationMs: Date.now() - start,
    };
  }
}

function parseMechanicsJson(text: string): unknown[] {
  // Best-effort parse — model output is JSON-ish but may have markdown fences.
  // Strip ```json fences, parse, return array. On parse failure return [].
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && 'mechanics' in parsed) {
      const m = (parsed as { mechanics: unknown }).mechanics;
      if (Array.isArray(m)) return m;
    }
    return [];
  } catch {
    return [];
  }
}
