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
npm run build

# Mock 어댑터로 스모크 테스트 (구독 불필요, 0원)
npx tsx src/index.ts run \
  --goal "60초 매치-3 + 콤보 보너스" \
  --adapter mock --idle-timeout 5000

# 결과 확인
ls sessions/                                    # ULID 디렉터리 1개 생성
jq -r '"\(.kind)\t\(.from)"' sessions/*/transcript.jsonl

# 결정론 재실행
npx tsx src/index.ts replay sessions/<session-id>
```

실제 에이전트 호출은 사용자 CLI 인증 후:

```bash
claude login   # Claude Max 구독
codex login    # OpenAI Plus 구독 (선택)
npx tsx src/index.ts run --goal "..."   # 기본 어댑터: claude-local + codex-local
```

## CLI

| 명령 | 동작 |
|---|---|
| `crumb run --goal "<피치>"` | 새 세션 시작 (actor별 기본 어댑터) |
| `crumb run --goal ... --adapter mock` | 모든 actor를 mock으로 강제 (결정론 데모) |
| `crumb event` | stdin JSON을 검증·append (서브프로세스 에이전트가 사용) |
| `crumb replay <session-dir>` | transcript에서 상태 재구성 (결정론 검증) |
| `crumb doctor` | 어댑터 헬스체크 (`claude --version`, `codex --version`) |
| `crumb ls` | `sessions/` 디렉터리 목록 + 이벤트 수 |

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

Walking skeleton 완료 (`a68651e`):

- [x] 스키마 검증 JSONL transcript (28 kinds × 11 fields, ajv 2020-12)
- [x] Pure reducer + circuit breaker + adaptive stop + rollback (vitest 13 specs)
- [x] Adapter — `claude-local` / `codex-local` / `mock` 3종
- [x] Live dispatcher — 서브프로세스 spawn + sandwich 주입
- [x] CLI — `run` / `event` / `replay` / `doctor` / `ls`
- [x] CI — lint + typecheck + format + test matrix (Node 18/20/22) + 스키마 검증
- [ ] `claude-local` + `codex-local` 실제 end-to-end 실행 (sandwich 갱신, 검증 중)
- [ ] TUI 관찰자 (blessed) — 현재는 `tail -f sessions/*/transcript.jsonl` 로 대체
- [ ] `summary.html` 후처리 리포트 생성기
- [ ] 데모 스크린캐스트

## 문서

- [AGENTS.md](./AGENTS.md) — 이 repo 에서 작업하는 에이전트/기여자용
- [agents/_event-protocol.md](./agents/_event-protocol.md) — 서브프로세스 에이전트가 `crumb event` 로 이벤트 emit 하는 방법
- [protocol/schema.md](./protocol/schema.md) — 1-page transcript spec
- [protocol/schemas/message.schema.json](./protocol/schemas/message.schema.json) — JSON Schema (draft 2020-12)
- [wiki/](./wiki/) — 설계 rationale (mango-wiki 의 subset)
  - [bagelcode-final-design-2026.md](./wiki/concepts/bagelcode-final-design-2026.md) — 최종 설계 spec

## License

MIT
