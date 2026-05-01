# Crumb

> 캐주얼 게임 prototype 을 위한 멀티 에이전트 실행 하네스. 한 줄 피치 → Planner Lead 와 Engineering Lead 가 Socratic / Concept / Research / Design / Builder / QA / CourtEval Verifier 로 협업, 사용자는 TUI 로 언제든 개입.

## 이름의 의미

**Crumb = 베이글 부스러기** — 베이글코드 brand motif 와, **breadcrumb pattern** (LLM agent 표준 path tracing / error steering, Hansel & Gretel metaphor), 그리고 transcript.jsonl 에 남는 에이전트 의사결정의 trail 의 3중 의미.

## 핵심 메시지

이 도구는 멀티 에이전트 협업을 단순 채팅이 아니라 **관찰·개입·평가·재현 가능한 실행 프로토콜**로 다룹니다.

베이글코드 [신작팀 AI 개발자 과제](https://career.bagelcode.com/ko/o/208045) (2026-05-03 마감) 응시작.

## 빠른 시작

```bash
git clone https://github.com/mangowhoiscloud/crumb.git
cd crumb
npm install

# 사용자 구독으로 인증 (API 키 불필요)
claude login   # Claude Max 구독 활용
codex login    # OpenAI Plus 구독 (--solo 모드는 생략 가능)

# 세션 실행
npm run dev -- run --preset standard "고양이 매치-3, 60초, 콤보 1.5x"
```

TUI 에서 에이전트 협업을 관찰하면서 `/note <텍스트>` 나 `/veto <id>` 로 언제든 개입.

## 모드

| Mode | 활성 actor | 용도 |
|---|---|---|
| `--solo` | Coord + 1 Lead (Claude only) | Anthropic 키만, 최소 셋업 |
| `--standard` (default) | Coord + Planner Lead + Engineering Lead + Verifier | Claude + Codex 정상 |
| `--rigorous` | + 진짜 specialist 분리 (Concept/Research/Design/QA) | Quality demo, 토큰 ~3× |
| `--parallel` | standard + Codex/Claude 병렬 builder | 속도 demo, 토큰 ~2× |

## 아키텍처 한 화면

```
USER ─[goal]─► COORDINATOR (Hub) ──┬──► PLANNER LEAD
                                     │     └─ Socratic / Concept / Research / Design / Synth
                                     ├──► ENGINEERING LEAD
                                     │     └─ Builder / QA / Verifier(CourtEval) / Synth
                                     └──► BUILDER.FALLBACK (Codex 죽으면)
```

- **외부**: 4 actor (subprocess 단위)
- **내부**: 7 specialist role (Lead 안 sequential)
- **Transcript**: 28 kind × 11 field × OTel GenAI alias
- **State**: pure reducer + 3 loop 변형 (live/replay/test)
- **비용**: $0/session (사용자 구독)

전체 설계 rationale 은 [wiki/bagelcode-final-design-2026.md](./wiki/bagelcode-final-design-2026.md).

## 결정의 근거

모든 architecture 결정이 2026 frontier 1차 사료에 backed:

- **Hub-Ledger-Spoke 토폴로지** — Lanham 2026-04 (centralized 4.4× error containment vs independent 17.2× amp)
- **4-actor short chain** — MIT 결정 이론 (5-stage relay → 22.5% accuracy 회귀)
- **Lead-Specialists internal sequential** — Paperclip Issue #3438 (35% skill bloat 회피)
- **CourtEval Verifier** — ACL 2025 (Grader/Critic/Defender/Re-grader)
- **Adaptive stopping** — NeurIPS 2025 multi-agent debate judge
- **Subprocess injection** — Karpathy LLM.txt + AGENTS.md (Linux Foundation 표준)
- **OTel GenAI alias** — Datadog/Vertex/Anthropic Console 표준

자세한 인용 chain 은 [wiki/synthesis/bagelcode-frontier-rationale-5-claims.md](./wiki/synthesis/bagelcode-frontier-rationale-5-claims.md).

## 산출물

성공한 세션이 만드는 4 deliverable:

```
sessions/<session-id>/
├── transcript.jsonl       # Replay-deterministic event log
├── artifacts/
│   ├── game.html          # Phaser 3.80 single-file 플레이 가능 게임
│   ├── spec.md            # Acceptance criteria + 룰북
│   ├── DESIGN.md          # 색감 / 메커닉 / 모션 spec
│   └── tuning.json        # 밸런스 수치 (Unity ScriptableObject 변환 가능)
└── summary.html           # 세션 끝 자동 생성 리포트
```

이 4 파일은 **Unity 신작팀의 input asset** — Crumb 는 production Unity workflow **앞 단계**의 prototype 검증 도구입니다.

## 상태

초기 개발 중. README 와 wiki/ 가 코드보다 앞서 있고, 36 시간 sprint 에 걸쳐 점진 구축 중.

## 문서

- [AGENTS.md](./AGENTS.md) — 이 repo 에서 작업하는 에이전트/기여자용
- [docs/architecture.md](./docs/architecture.md) — Architecture deep-dive
- [docs/observability.md](./docs/observability.md) — 자체 구축 observability rationale
- [protocol/schema.md](./protocol/schema.md) — 1-page transcript spec
- [wiki/](./wiki/) — 설계 rationale (mango-wiki 의 subset)

## License

MIT
