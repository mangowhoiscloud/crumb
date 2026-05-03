---
title: TradingAgents (arXiv 2412.20138) — Multi-Agent LLM Communication Protocol
category: references
tags: [bagelcode, multi-agent, communication-protocol, transcript, react, metagpt, structured-comms]
sources:
  - "https://arxiv.org/abs/2412.20138"
  - "https://arxiv.org/pdf/2412.20138"
  - "raw/bagelcode-research/tradingagents-2412.20138.{pdf,txt}"
created: 2026-05-01
updated: 2026-05-01
---

# TradingAgents — Key lessons on Multi-Agent LLM communication protocol

> **Paper**: Yijia Xiao, Edward Sun, Di Luo, Wei Wang. *TradingAgents: Multi-Agents LLM Financial Trading Framework.* arXiv:2412.20138v7 (2025-06-03). UCLA + MIT + Tauric Research. Code: https://github.com/TauricResearch/TradingAgents
>
> **This page is extracted from the actual PDF body.** (The earlier WebFetch-aided summary contained some hallucinations — fake token figures, fake metadata fields, etc., are excluded from this page.)

## Why this matters to us

The essence of the Bagelcode task is **the design of how multiple LLM agents communicate with each other**. Two insights from this paper apply directly:

1. **Pure natural-language communication is a "telephone game" — information loss + context decay**
2. **A mix of structured documents/diagrams + limited natural-language dialogue** is the key

§4.1 and §4.2 are the primary basis for our transcripts schema decision.

## §4.1 Communication Protocol (verbatim core)

Paper verbatim:

> "Most existing LLM-based agent frameworks use natural language as the primary communication interface, typically through structured message histories or collections of agent-generated messages. However, relying solely on natural language often proves insufficient for solving complex, long-term tasks that require extensive planning horizons. In such cases, pure natural language communication can resemble a **game of telephone**—over multiple iterations, initial information may be forgotten or distorted due to context length limitations and an overload of text that obscures critical earlier details."

Solution:
> "We draw inspiration from frameworks like **MetaGPT**, which adopt a structured approach to communication. Our model introduces a **structured communication protocol to govern agent interactions**. By clearly defining each agent's state, we ensure that each role only extracts or queries the necessary information, processes it, and returns a completed report."

→ **Each agent queries only what it needs from the global state.** It does not carry the entire message history around.

## §4.2 Types of Agent Interactions (5 stages)

| Stage | Actor | Communication mode | Output |
|---|---|---|---|
| I | Analyst Team (Fundamental/Sentiment/News/Technical) | **structured report** | Domain-specific analysis report |
| II | Traders | **structured report** | decision signal + rationale |
| III | Researcher Team (Bullish vs Bearish) | natural language **debate** (n rounds) → facilitator records as **structured entry** | debate conclusion |
| IV | Risk Management Team (Risky/Neutral/Conservative) | natural language **debate** (n rounds) → facilitator summarizes | risk-adjusted recommendation |
| V | Fund Manager | structured update | final trader decision + report |

**Key pattern:**
- **analysis/execution = structured documents**
- **discussion/debate = natural language**, but the conclusion is reduced back to a structured entry
- Every natural-language dialogue is persisted as **one entry within the structured framework**

verbatim:
> "TradingAgents agents communicate primarily through structured documents and diagrams... Agents engage in natural language dialogue exclusively during agent-to-agent conversations and debates."

## §4.3 Backbone LLMs — model separation

The paper splits **quick-thinking** and **deep-thinking** models by role:

| Model type | Example | Responsibility |
|---|---|---|
| Quick-thinking | gpt-4o-mini, gpt-4o | summarization, data retrieval, table → text conversion |
| Deep-thinking | o1-preview | decision-making, evidence-based report, analysis |

> "all analyst nodes rely on **deep-thinking** models to ensure robust analysis, while **quick-thinking** models handle data retrieval from APIs and tools for efficiency."

**Application to the task:** Coordinator/router = quick (Haiku/Flash), Planner/Critic = deep (Opus/o1/Gemini-pro). The model mix itself aligns with Bagelcode's stated "Claude/Codex/Gemini etc."

## ReAct Prompting Framework

> "All agents in TradingAgents follow the **ReAct** prompting framework (Yao et al., 2023), which synergizes reasoning and acting."

→ Thought → Action → Observation loop. The standard skeleton for an agent's system prompt.

## §5.1 Performance Metrics (4 metrics)

| Metric | Meaning |
|---|---|
| Cumulative Return (CR) | Cumulative return |
| Annualized Return (AR) | Annualized return |
| Sharpe Ratio (SR) | Risk-adjusted return |
| Maximum Drawdown (MDD) | Maximum drawdown |

→ **Inspiration for rubric design**: 3 axes — domain metrics + risk metrics + efficiency metrics. For our task, this translates into → **output accuracy + token efficiency + user-intervention count** ([[bagelcode-rubric-scoring]]).

## §5.2 Backtesting Setup

- Period: 2024-01-01 ~ 2024-03-29
- Tickers: AAPL, NVDA, MSFT, META, GOOG (Big Tech 5)
- 5 baselines: Buy-and-Hold, MACD, KDJ+RSI, ZMR, SMA
- Look-ahead bias removed: only data up to each trading day used

## Results (paper §6)

| Metric | TradingAgents | Baseline lead |
|---|---|---|
| Cumulative Return | Outperforms baseline (specific numbers per ticker) | On all assets |
| Sharpe Ratio | Outperforms | On all assets |
| Max Drawdown | Outperforms (lower = better) | On most |

> "TradingAgents achieves significant improvements in cumulative returns, Sharpe ratio, and maximum drawdown."

## §6.1.4 Explainability — directly tied to our task

> "an LLM-based agentic framework offers a transformative advantage: its decisions are accompanied by **detailed reasoning, tool usage, and grounding evidence** through ReAct prompting."

→ Exactly matches why Bagelcode requires "include .md files + session log JSONL". **transcript = explainability.** The evaluator must be able to trace the agent's decisions.

## Limitations (extracted from paper §6.2 + §7 conclusion)

- Short backtest period (3 months) → market regime changes not reflected
- Limited asset class (5 Big Tech stocks)
- LLM hallucination risk
- Trading costs and slippage not reflected

## 5 key decisions to bring into our task

1. **structured-by-default + dialogue-by-exception** — only debate/discussion in natural language; everything else as schema-locked messages
2. **There is a global state that each agent queries** — no broadcast of message history; pull "only what is needed"
3. **Natural-language dialogue is also persisted as a structured entry in the end** — the core principle of the JSONL transcript
4. **Model separation**: quick (router) / deep (planner+critic)
5. **ReAct skeleton** to standardize all system prompts

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-transcripts-schema]] — our schema based on §4 of this paper
- [[bagelcode-caching-strategy]] — quick/deep separation + cache boundary
- [[bagelcode-rubric-scoring]] — the §5.1 4 metrics translated into our task
- [[geode-prompt-system]] / [[geode-adaptive-thinking]] — model separation / thinking-effort inspiration
