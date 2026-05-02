# Crumb — Gemini CLI extension context

> 베이글코드 신작팀 멀티 에이전트 협업 도구. Gemini CLI 가 host harness 일 때 사용.
> See: wiki/concepts/bagelcode-system-architecture-v3.md

## 시스템 정체성

Crumb 은 5 actor (coordinator + planner-lead + builder + verifier + builder-fallback) 가
transcript JSONL (39 kind × 11 field) 위에서 협업하는 multi-agent harness.

자연어 goal → spec → build → qa_check (deterministic) → verify (CourtEval inline) → done.

## Gemini 의 자리 (default preset bagelcode-cross-3way)

- coordinator: ambient (gemini-cli)
- planner-lead: ambient (gemini-cli)
- builder: codex CLI subprocess (다른 host)
- **verifier: gemini-cli** ← 이 위치, multimodal screenshot 검증 활용
- builder-fallback: ambient

Gemini 가 verifier 인 이유: 2.5-pro 의 multimodal capability 가 game.html 의 screenshot 검증에
유리. CourtEval 4 sub-step (Grader / Critic / Defender / Re-grader) inline 으로 D1 spec_fit
+ D3.semantic + D5.quality LLM judgment 차원 산출.

## 사용

```
/crumb 60초 매치-3 콤보 게임 만들어줘
```

Extension 의 commands/crumb.toml 이 trigger. coordinator role 으로 진입.

## 사용자 개입

자연어로 진행 중 message → kind=user.intervene. 다음 spec/build 에 반영.

## 산출

`sessions/<session-id>/artifacts/`:
- game.html (Phaser 3.80 single-file, ≤60KB)
- spec.md / DESIGN.md / tuning.json
- summary.html (post-session 자동)

## See also

- agents/coordinator.md — sandwich body
- agents/verifier.md — Gemini 가 verifier 일 때 inline read
- skills/verification-before-completion.md — evidence-over-claims
- wiki/references/bagelcode-frontier-cli-convergence-2026.md — 4 CLI 합의
