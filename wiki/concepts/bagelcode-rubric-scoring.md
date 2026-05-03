---
title: Bagelcode Task — Rubric-Based Scoring (Effectiveness vs Token Investment)
category: concepts
tags: [bagelcode, rubric, scoring, evaluation, efficiency, tokens, anti-deception]
sources:
  - "[[bagelcode-tradingagents-paper]]"
  - "[[bagelcode-transcripts-schema]]"
  - "[[bagelcode-caching-strategy]]"
  - "[[kiki-scorecard-guards]]"
created: 2026-05-01
updated: 2026-05-01
---

# Rubric-Based Scoring — Effectiveness vs Token Investment

> The most common failure in multi-agent systems: **lots of tokens spent, weak result**. Or **agents praising each other while no real verification happens**. This page is the spec for the rubric and measurement data that catches both of those failure modes.
>
> Inspiration: [[bagelcode-tradingagents-paper]] §5.1 (4 metrics) + [[kiki-scorecard-guards]] (C2/C8/C10) + Karpathy P4 (anti-deception ratchet).

## Two measurement targets

```
                   ┌─ 1) Outcome Quality   (how good the work product is)
Rubric measures ──┤
                   └─ 2) Efficiency        (that goodness per token / $)
```

→ **You have to measure both for it to be meaningful.** "Just good" is expensive, "just cheap" is nonsense. The ratio (quality/cost) is the real signal.

## Dimensions (5 dimensions × 5 points)

Adopting the 5-point scale from [[kiki-scorecard-guards]]. Each dimension 0-5, summed to a 25-point maximum:

| # | Dimension | Definition | Measurement Method |
|---|---|---|---|
| **D1** | **Spec Conformance** | Does the Builder's output satisfy the Spec ACs | Critic checks each AC ✓/✗ |
| **D2** | **Executability** | Does it actually run as the README says | Critic runs `run_cmd` + exit code |
| **D3** | **User Observability** | Can decisions be traced from the transcript alone | Auto: kind diversity + average body length |
| **D4** | **Consensus Convergence** | Do agents avoid going in circles repeating the same thing | Auto: spec.update count, infinite-loop detection |
| **D5** | **User Intervention Efficiency** | When the user steps in, does it actually get reflected | Auto: user.intervene → whether the next spec/build changes |

D1+D2 = direct outcome quality. D3+D4+D5 = process quality (the essence of multi-agent collaboration).

## D1 Spec Conformance — auto/semi-auto mix

```
score = 5 × (number of ACs satisfied / total number of ACs)
```

Detailed scoring (Critic's `verify.result.dimensions.spec_fit`):

```jsonc
{
  "spec_fit": {
    "score": 4.5,
    "criteria": [
      {"ac": "GET /todos returns 200", "result": "PASS", "evidence": "curl ... 200"},
      {"ac": "POST creates todo", "result": "PASS", "evidence": "..."},
      {"ac": "DELETE removes", "result": "PARTIAL", "evidence": "404 instead of 204"}
    ]
  }
}
```

→ The Critic's verify.result **must fill in this schema** to derive the D1 score. If unfilled, automatic 0 (anti-deception).

## D2 Executability — objective measurement

The Critic runs the artifact's `run_cmd` → captures stdout/stderr → records to transcript:

```jsonc
{
  "kind": "verify.result",
  "data": {
    "exec": {
      "cmd": "python -m pytest -q",
      "exit_code": 0,
      "duration_ms": 1240,
      "stdout_tail": "5 passed in 0.34s"
    }
  }
}
```

If `exit_code == 0` and stdout has no fail patterns, 5 points; otherwise 0. **No execution result = automatic 0.**

→ Karpathy P4 (anti-deception): the rule "if the Critic writes PASS but there's no exit_code, it's invalid" is hard-coded.

## D3 User Observability — automatic measurement

Extracted from the transcript itself:

```python
def D3(transcript: list[Message]) -> float:
    kinds = {m.kind for m in transcript}
    diversity = len(kinds & {"goal", "spec", "build", "verify.result", "done"})  # 0-5
    avg_body = mean(len(m.body) for m in transcript if m.body)
    coverage = 1.0 if avg_body > 80 else avg_body / 80  # docked if too short
    return min(5.0, diversity + coverage * 0.5)
```

→ "kind diversity ≥ 5 AND average body ≥ 80 chars" = 5 points. Trivial echo ping-pong gets auto-docked.

## D4 Consensus Convergence — automatic measurement

Detect infinite loops / ping-pong:

```python
def D4(transcript: list[Message]) -> float:
    spec_count = count(kind="spec") + count(kind="spec.update")
    if spec_count > 5: return 1.0      # rewriting the spec 5+ times = convergence failure
    build_count = count(kind="build")
    if build_count > 3: return 2.0     # 3+ builds = weak convergence
    if has_user_veto_chain(): return 3.0
    return 5.0                          # clean 1-pass convergence
```

## D5 User Intervention Efficiency — automatic measurement

```python
def D5(transcript: list[Message]) -> float:
    interventions = filter(kind="user.intervene")
    if not interventions: return 5.0   # no interventions = full score (system didn't need it)
    responded = count(intervene → next spec/build with reference)
    return 5.0 * (responded / len(interventions))
```

→ "Don't ignore user interventions" is the real value of a multi-agent system. Measures whether each intervention got a response.

## Efficiency — separate dimension

On top of the 25-point quality, an efficiency ratio **per token investment**:

```
total_cost   = sum(tokens_in × price_in + tokens_out × price_out for each msg)
quality      = D1+D2+D3+D4+D5  (0-25)
cache_ratio  = sum(cache_read) / sum(tokens_in)
intervention_burden = count(user.intervene + user.veto + user.redo)

efficiency_score = (quality / 25) / (total_cost / $1)   # quality fraction per $1
```

**Target (at submission):**

| Metric | Target |
|---|---|
| Quality (sum 25) | ≥ 20 (each dimension ≥ 4) |
| Total cost | ≤ $1.5 / session |
| Cache hit ratio | ≥ 60% |
| Intervention burden | ≤ 2 / session (too many interventions makes the tool pointless) |
| Efficiency score | ≥ 0.5 / $ |

→ These 5 numbers go into the README as demo session results. **A system grading itself** is the most honest signal to an evaluator.

## Mapping to TradingAgents §5.1

| TradingAgents 4 metrics | Our 5 dimensions |
|---|---|
| Cumulative Return | D1 + D2 (outcome) |
| Sharpe Ratio (risk-adjusted) | quality / cost (risk = token cost) |
| Max Drawdown | D4 infinite-loop detection (worst-case convergence failure) |
| Annualized Return | efficiency_score (time unit → cost unit) |

→ Different domain, but the skeleton is the same: **outcome × efficiency × worst-case safety**.

## Anti-Deception Rules (our implementation of Karpathy P4)

| Rule | On violation |
|---|---|
| Critic says PASS but no `exec.exit_code` | Force D2 = 0 |
| Critic says PASS but no `criteria` array | Force D1 = 0 |
| Spec has empty AC | Force D1 = 0 |
| Builder built but no artifacts | Force D2 = 0 |
| User user.veto then straight to done | Force D5 = 0 + force overall 0 |

→ These rules are **part of the transcript validator**. Scoring ultimately is the result of schema validation. (Same code path as the JSON Schema in [[bagelcode-transcripts-schema]] §"TBD/follow-up".)

## Single-session scoring example

Applying the example transcript from [[bagelcode-transcripts-schema]] above:

| Dimension | Score | Rationale |
|---|---|---|
| D1 Spec Conformance | 4.7 | 3/3 AC PASS, dimensions.criteria filled in |
| D2 Executability | 5.0 | exit_code=0, "5 passed" |
| D3 Observability | 5.0 | 5 kinds diversity, sufficient avg body |
| D4 Convergence | 5.0 | spec_update once, build once |
| D5 Intervention Efficiency | 5.0 | intervene 0 times |
| **Quality** | **24.7 / 25** | |
| total cost | $0.045 | summed tokens |
| cache hit | 92% | sandwich hit |
| **Efficiency** | **22 / $1** | quality 0.99 / cost 0.045 |

→ Auto-computed at the end of every session and appended to the transcript as `kind=audit`.

## TBD / Follow-up

- [ ] Per-dimension weighting (all equal vs D1·D2 weighted)
- [ ] Update cadence for the price table (`PRICE_TABLE.json`) per model
- [ ] Critic can't self-grade D1 when it does its own verification → split out into a separate evaluator module?
- [ ] LLM-as-judge skepticism — the Critic's D1 evaluation may be hallucinated. Solution: D1 = Critic + regex / pytest etc. code-verification mix.

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-transcripts-schema]] — scoring input
- [[bagelcode-caching-strategy]] — efficiency denominator measurement
- [[bagelcode-tradingagents-paper]] §5.1 4-metric set
- [[kiki-scorecard-guards]] — 5-point × N-dimension spec, C8/C10 anti-deception inspiration
