#!/usr/bin/env bash
# S2 spike — 30-min env propagation validation across 3 host harnesses.
#
# Goal: verify that subagents spawned from Claude Code Task tool / Codex subagent / Gemini
# extension MCP can read parent env vars (CRUMB_TRANSCRIPT_PATH, CRUMB_SESSION_ID,
# CRUMB_SESSION_DIR, CRUMB_ACTOR) and call `crumb event` to append to the transcript.
#
# Run: bash scripts/spike-env-propagation.sh
# Result: ingest into wiki/synthesis/bagelcode-env-propagation-spike-2026-05-02.md
#
# References: wiki/synthesis/bagelcode-host-harness-decision.md §"검증 필요 미지수" Q1-Q3
#             wiki/concepts/bagelcode-system-architecture-v3.md §S2 spike

set -uo pipefail

SPIKE_DIR="/tmp/crumb-spike-$(date +%s)"
mkdir -p "$SPIKE_DIR"

export CRUMB_TRANSCRIPT_PATH="$SPIKE_DIR/transcript.jsonl"
export CRUMB_SESSION_ID="01J-spike-$(date +%s)"
export CRUMB_SESSION_DIR="$SPIKE_DIR"
export CRUMB_ACTOR="spike-test"

touch "$CRUMB_TRANSCRIPT_PATH"

echo "=== Spike directory: $SPIKE_DIR ==="
echo "CRUMB_TRANSCRIPT_PATH=$CRUMB_TRANSCRIPT_PATH"
echo "CRUMB_SESSION_ID=$CRUMB_SESSION_ID"
echo

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

record() {
  local name="$1"; local status="$2"; local detail="$3"
  if [ "$status" = "PASS" ]; then PASS_COUNT=$((PASS_COUNT+1)); else FAIL_COUNT=$((FAIL_COUNT+1)); fi
  RESULTS+=("$name | $status | $detail")
}

# ── Q1: Claude Code Task tool env propagation ─────────────────────────────────
echo "─── Q1: Claude Code env propagation ───"
if command -v claude >/dev/null 2>&1; then
  Q1_OUT=$(claude --print "Run this command and show the output: bash -c 'echo CRUMB_TRANSCRIPT_PATH=\$CRUMB_TRANSCRIPT_PATH && echo CRUMB_SESSION_ID=\$CRUMB_SESSION_ID'" 2>&1 || echo "ERROR")
  if echo "$Q1_OUT" | grep -q "$CRUMB_SESSION_ID"; then
    record "Q1 claude-code env" "PASS" "Task subagent inherited parent env"
  else
    record "Q1 claude-code env" "FAIL" "env not propagated — need explicit export in sandwich"
  fi
  echo "$Q1_OUT" | head -20
else
  record "Q1 claude-code env" "SKIP" "claude CLI not installed"
fi
echo

# ── Q2: Codex subagent TOML env propagation ───────────────────────────────────
echo "─── Q2: Codex subagent env propagation ───"
if command -v codex >/dev/null 2>&1; then
  Q2_OUT=$(codex exec --skip-git-repo-check --sandbox-mode workspace-write \
    "Run: bash -c 'echo CRUMB_TRANSCRIPT_PATH=\$CRUMB_TRANSCRIPT_PATH && echo CRUMB_SESSION_ID=\$CRUMB_SESSION_ID'" 2>&1 || echo "ERROR")
  if echo "$Q2_OUT" | grep -q "$CRUMB_SESSION_ID"; then
    record "Q2 codex env" "PASS" "Codex subprocess inherited parent env"
  else
    record "Q2 codex env" "FAIL" "env not propagated — need TOML developer_instructions hint"
  fi
  echo "$Q2_OUT" | head -20
else
  record "Q2 codex env" "SKIP" "codex CLI not installed"
fi
echo

# ── Q3: Gemini CLI extension env ───────────────────────────────────────────────
echo "─── Q3: Gemini CLI env propagation ───"
if command -v gemini >/dev/null 2>&1; then
  Q3_OUT=$(gemini --prompt "Run shell: echo CRUMB_TRANSCRIPT_PATH=\$CRUMB_TRANSCRIPT_PATH" 2>&1 || echo "ERROR")
  if echo "$Q3_OUT" | grep -q "$CRUMB_SESSION_ID"; then
    record "Q3 gemini env" "PASS" "Gemini inherited parent env"
  else
    record "Q3 gemini env" "FAIL" "env not propagated — need extension config or shell wrapper"
  fi
  echo "$Q3_OUT" | head -20
else
  record "Q3 gemini env" "SKIP" "gemini CLI not installed"
fi
echo

# ── Q4: `crumb event` callable from child cwd ─────────────────────────────────
echo "─── Q4: crumb event callable from child ───"
if command -v npx >/dev/null 2>&1; then
  cd "$SPIKE_DIR"
  Q4_OUT=$(echo '{"from":"system","kind":"note","body":"Q4 spike — crumb event from child cwd","metadata":{"visibility":"public"}}' \
    | npx --prefix /Users/mango/workspace/crumb tsx /Users/mango/workspace/crumb/src/index.ts event 2>&1 || echo "ERROR")
  if [ -s "$CRUMB_TRANSCRIPT_PATH" ] && grep -q "Q4 spike" "$CRUMB_TRANSCRIPT_PATH"; then
    record "Q4 crumb-event-call" "PASS" "child cwd successfully appended to transcript"
  else
    record "Q4 crumb-event-call" "FAIL" "$(echo $Q4_OUT | head -c 200)"
  fi
  cd - >/dev/null
else
  record "Q4 crumb-event-call" "SKIP" "npx not available"
fi
echo

# ── Q5: Sandwich format conversion (XML → Markdown for Codex) ─────────────────
echo "─── Q5: Sandwich format check ───"
if [ -f "/Users/mango/workspace/crumb/agents/coordinator.md" ]; then
  if grep -q "^<role>" /Users/mango/workspace/crumb/agents/coordinator.md; then
    record "Q5 sandwich-format" "PASS" "coordinator.md uses XML tags (claude-code primary format)"
  else
    record "Q5 sandwich-format" "FAIL" "coordinator.md missing expected XML structure"
  fi
else
  record "Q5 sandwich-format" "FAIL" "agents/coordinator.md missing"
fi
echo

# ── Summary ─────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════════"
echo "                    SPIKE RESULTS"
echo "═══════════════════════════════════════════════════════════════════"
printf "%-25s | %-6s | %s\n" "Check" "Result" "Detail"
printf "%-25s | %-6s | %s\n" "-------------------------" "------" "-------"
for r in "${RESULTS[@]}"; do
  IFS=' | ' read -r name status detail <<< "$r"
  printf "%-25s | %-6s | %s\n" "$name" "$status" "$detail"
done
echo
echo "PASS: $PASS_COUNT, FAIL: $FAIL_COUNT (skipped not counted)"
echo
echo "Transcript at: $CRUMB_TRANSCRIPT_PATH"
[ -s "$CRUMB_TRANSCRIPT_PATH" ] && wc -l "$CRUMB_TRANSCRIPT_PATH"
echo
echo "Next: ingest results into wiki/synthesis/bagelcode-env-propagation-spike-2026-05-02.md"
