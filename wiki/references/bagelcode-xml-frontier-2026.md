---
title: Bagelcode Task — XML in LLM sources + our system's adoption policy
category: references
tags: [bagelcode, xml, prompt-engineering, anthropic, claude-code, structured-prompt, format, frontier, 2026]
sources:
  - "Anthropic prompt engineering docs"
  - "Claude Code reverse engineering reports"
  - "arXiv 2025-2026 XML/structured prompting papers"
  - "Multi-agent communication protocol surveys"
created: 2026-05-01
updated: 2026-05-01
---

# XML in LLM — 2026-05 Sources + Our System's Adoption Policy

> **One-line conclusion**: **Inside the system prompt = XML (Anthropic-native, Claude Code-native), Wire/Storage = JSON (transcript), natural-language body = free text (isolated either inside XML or inside the JSON `body` field).**
>
> XML is Anthropic's officially recommended pattern, but there is also research saying the opposite — **format restriction degrades reasoning**. So the boundary decision of "where to use it and where not to" is the crux.

## Tier 1 — Anthropic native (recommended adoption)

### 1A. Anthropic official guide — Use XML tags to structure your prompts

URL: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags

**Key statements (verbatim summary):**
> "When prompts involve multiple components like context, instructions, and examples, XML tags can be a game-changer."
>
> "**Claude was trained with XML tags** in the training data... Claude was trained specifically to recognize XML tags as a prompt organizing mechanism."

**4 benefits emphasized by Anthropic:**
1. **Clarity** — clearly separates parts of the prompt
2. **Reduced misinterpretation** — lower risk of Claude misreading a part
3. **Flexibility** — easier to modify parts
4. **Post-processing** — easier to extract specific parts from the response

**Nested tag principle (verbatim):**
> "Nest when content has a natural containment relationship—for example, a `<documents>` container holding multiple `<document>` elements, or a `<conversation>` container holding `<message>` elements. Don't nest just for visual organization — nest when the parent-child relationship conveys real semantic meaning."

**Multi-document pattern:**
```xml
<documents>
  <document>
    <document_content>...</document_content>
    <source>...</source>
  </document>
</documents>
```

### 1B. Actual XML usage by Claude Code (reverse engineering reports)

URL: https://medium.com/@fengliu_367/the-complete-guide-to-writing-agent-system-prompts-... · https://karanprasad.com/blog/how-claude-code-actually-works-...

**XML tags Claude Code actually uses:**

| Tag | Purpose |
|---|---|
| `<system-reminder>` | injected at end of turn, reinforces rules. **Distinct from user utterance** |
| `<good-example>` / `<bad-example>` | few-shot heuristic learning |
| `<env>` | runtime context (date, git status, project rules) |
| `<thinking>` | internal reasoning (linked to extended thinking) |
| `<function_calls>` / `<function_results>` | tool use payload |

**Structural conventions:**
- Markdown headers (`##`, `###`) = hierarchy
- Bullet lists = independent testable rules
- XML tags = semantically separate sections

→ **Reinforces the "built with an AI coding agent" signal**: if our sandwich uses the `<system-reminder>` tag, evaluators will read it as "this person knows Claude Code's internal patterns."

### 1C. Anthropic Prompting Best Practices (Opus 4.7 baseline)

URL: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices

A long document (60KB+). Key points:
- **Long context (200K+)**: XML tagging improves retrieval performance (consistent with the TAG paper)
- **Tool definitions**: combination with XML schema recommended
- **Examples (few-shot)**: isolate with `<example>` tags

## Tier 2 — Academic (formal guarantees + measured effects)

### 2A. XML Prompting as Grammar-Constrained Interaction (arXiv 2509.08182)

URL: https://arxiv.org/abs/2509.08182

**Core:** **Mathematical formalization** of XML-tag-based prompting.
- Knaster-Tarski theorem proves fixed-point convergence of the XML tree
- Banach contraction principle guarantees convergence under iterated application
- CFG (Context-Free Grammar)-based schema ensures format correctness
- The convergence of multi-step "plan → verify → revise" patterns is directly tied to **preventing infinite agent loops**

**Our application:** if sandwich §4 routing enforcement is grammar-constrained, then [[bagelcode-fault-tolerance-design]] §F5 stuck escalation also has a formal basis.

### 2B. Tagging-Augmented Generation — TAG (arXiv 2510.22956)

URL: https://arxiv.org/html/2510.22956v1

**Core:** improving long-context retrieval performance via **semantic tagging**.
- Measured on a 200K context window (Claude Sonnet 3.5/3.7)
- NoLiMa, NovelQA benchmarks
- Effect ↑ purely by embedding tags inside the prompt — **no architectural changes**

**Verbatim summary:**
> "embedding explicit structural cues within the input to guide model attention, preserve information retention, and enhance reasoning quality"

**Our application:** in long sessions where the transcript grows, embedding **anchored summaries** ([[bagelcode-caching-strategy]] T2.3) in XML tags (`<summary>`, `<decision>`, `<next-step>`) ↑ retrieval.

### 2C. StructEval — Structured Output Benchmark (arXiv 2505.20139)

URL: https://arxiv.org/html/2505.20139v1

Measures LLMs' XML/JSON/YAML/Markdown output ability. The core finding is **how fail rate changes at deeper hierarchy**.

**Implications for us:**
- Our transcript JSON `data` only has 1-2 levels of nesting — few traps
- XML inside the system prompt is OK up to 3-4 levels (Anthropic recommendation)

### 2D. Let Me Speak Freely — Side effects of format restriction (arXiv 2408.02442)

URL: https://arxiv.org/html/2408.02442v1

**Warning (verbatim summary):**
> "Structured format constraints (JSON, XML, YAML) degrade LLM reasoning ability... a balance must be struck between easily parseable structured outputs and preserving the LLM's inherent reasoning abilities, with practitioners potentially considering looser format restrictions when dealing with complex reasoning tasks."

**Implications for us:**
- **XML received as input** = OK (Anthropic-trained, TAG effect ↑)
- **Forcing output schema** = handle with care. For reasoning-heavy steps (Planner spec writing, Critic verification reasoning), **free text → post-processing schema extraction** is safer
- → Aligns with our decision to separate transcript `body` (free text) and `data` (schema) ([[bagelcode-transcripts-schema]])

### 2E. YAML > XML for some retrieval (improvingagents.com)

URL: https://www.improvingagents.com/blog/best-nested-data-format/

**Measurement:** GPT-5 Nano achieves **17.7%p higher accuracy** with YAML than XML. 1,000 questions, nested data retrieval task.

| Format | GPT-5 Nano accuracy | Notes |
|---|---|---|
| YAML | best | indentation-dependent — whitespace-fragile |
| Markdown | mid | familiar to humans and LLMs alike |
| JSON | mid | standard, rich parsers |
| XML | worst | verbose, weak in GPT family |

**Implications for us:**
- For Builder.B (Codex/GPT-5.5), **prefer markdown/JSON over XML for input**
- For Claude (Builder.A, and Verifier when Claude-family), XML is OK
- → **Per-provider prompt format branching is needed**. Auto-convert in the adapter.

## Tier 3 — XML in multi-agent protocols

### 3A. Agent Communication Protocols Survey (arXiv 2505.02279)

URL: https://arxiv.org/html/2505.02279v1

**Historical summary:**
- **KQML, FIPA-ACL** (1990-2000s) = XML-based, **heavyweight → no adoption outside academia/defense**
- **MCP, A2A, ANP** (2024-2025) = **JSON / JSON-RPC-based** = lightweight adoption

**Verbatim:**
> "KQML's heavyweight XML-style encodings hindered large-scale deployments"
> "the complexity of FIPA's ontology management, coupled with verbose XML encodings, limited its uptake to academic and defense use cases"

**Our decision:** **Do not adopt XML as a wire format.** Keep JSONL transcript. XML only inside the Anthropic-native system prompt.

### 3B. Why MCP / A2A use JSON-RPC

URL: https://a2a-protocol.org/latest/specification/

- Lightweight
- Streaming-friendly (SSE)
- Broad SDK support
- Easy debugging

→ 1:1 with our transcript.

## Synthesis — XML policy for our system

### Policy table

| Location | Format | Rationale |
|---|---|---|
| **System prompt (sandwich §1-§4)** | **XML tags** | Anthropic training + Claude Code patterns + TAG effect |
| **Tool definitions** | JSON Schema (inside an XML wrapper) | MCP convention + Anthropic recommendation |
| **Few-shot examples in prompt** | `<good-example>` / `<bad-example>` | Claude Code internal pattern |
| **Runtime context injection** | `<system-reminder>` / `<env>` | Claude Code native |
| **Transcript wire (JSONL)** | JSON | KQML/FIPA lessons + MCP alignment |
| **Inter-agent message body** | JSON `data` schema + free `body` | preserves reasoning ([[bagelcode-transcripts-schema]]) |
| **Long-session anchored summary** | XML tags (inside `<summary>`) | TAG retrieval effect |
| **Forcing output schema** | **Handle with care** | reasoning degradation risk; separate body=text/data=schema |
| **Builder.B (Codex) input** | Markdown / JSON preferred | YAML/XML traps (Tier 2E) |

### Concrete XML for sandwich §1-§4

```xml
<role>
  You are <name>Builder.A</name> in the Crumb pipeline.
  <provider>Anthropic Claude Opus 4.7</provider>
  <position>Builder, primary</position>
</role>

<contract>
  <input>
    From transcript: messages where kind in {goal, spec, spec.update}
  </input>
  <output>
    Single JSON message with kind="build", artifacts in artifacts/ dir.
  </output>
  <handoff>
    On success → coordinator. On failure → kind="error" with reason.
  </handoff>
</contract>

<tools>
  <!-- tool definitions follow standard Claude tool_use schema -->
</tools>

<enforcement>
  <forbidden>
    - Calling Agent/Task tool (single stage owner principle)
    - Reading messages with kind in {debate, note}
    - Writing to artifacts outside assigned session_id
  </forbidden>
  <required>
    - Append exactly one kind="build" message
    - sha256 every artifact ref
    - STOP after own turn
  </required>
</enforcement>

<system-reminder>
You are in production path. Verifier will check exec.exit_code.
Anti-deception: claiming build without artifacts → automatic D2=0.
</system-reminder>
```

→ Anthropic's Claude Opus 4.7 / Haiku 4.5 parse this structure best.

### Conversion for Builder.B (Codex)

Auto-converts the same sandwich to **Markdown** (inside the adapter):

```markdown
# Role
You are Builder.B in the Crumb pipeline.
- Provider: OpenAI GPT-5.5 (via Codex)
- Position: Builder, fallback

## Contract
- **Input**: transcript messages where kind ∈ {goal, spec, spec.update}
- **Output**: single JSON message kind="build", artifacts in artifacts/
- **Handoff**: success → coordinator. failure → kind="error".

## Forbidden
- Recursive subagent spawn
- Reading kind ∈ {debate, note}
- Writing outside session_id

## Required
- Exactly one kind="build" message
- sha256 every artifact ref
- STOP after own turn

> System reminder: Verifier checks exec.exit_code. Build without artifacts → D2=0.
```

→ The adapter generates two outputs (XML/Markdown) from the same source. **Maintenance cost 1×, output 2×.**

## Savings/effect estimates

| Effect | Estimate |
|---|---|
| Claude long-context retrieval | +5-15%p per the TAG paper (NoLiMa) |
| Claude rule compliance (anti-deception) | the `<system-reminder>` pattern = same effect as Claude Code |
| Codex GPT-5.5 reasoning | -10%p risk if XML forced (Tier 2D) → avoid via Markdown |
| Format consistency (post-processing) | extracting specific tags from a response = simple regex |
| Multi-actor sandwich sharing | XML byte-identical = ↑ prompt cache hit ([[bagelcode-caching-strategy]]) |

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Infinite nesting → format burden | Nest only on semantic containment (Anthropic rule) |
| Forcing XML output schema → reasoning ↓ | Output as JSON `data` + free `body`, separated |
| Codex weak at XML | Adapter converts to Markdown |
| What if `<system-reminder>` shows up faked in LLM output? | Validator strips and rejects `<system-reminder>` from output |
| What if Claude Code itself injects `<system-reminder>` into its output? | Consider isolating our system's XML namespace with a `<pc:...>` prefix |

## Primary sources (10-link bundle)

### Anthropic native
- [Use XML tags to structure your prompts (Anthropic docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags)
- [Prompting best practices (Opus 4.7+)](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)

### Claude Code reverse engineering
- [Reverse-engineering Claude Code (Karan Prasad)](https://karanprasad.com/blog/how-claude-code-actually-works-reverse-engineering-512k-lines)
- [Complete Guide to Agent System Prompts (Feng Liu)](https://medium.com/@fengliu_367/the-complete-guide-to-writing-agent-system-prompts-lessons-from-reverse-engineering-claude-code-09ecd87c7cc1)
- [Claude Code Architecture (Vrungta)](https://vrungta.substack.com/p/claude-code-architecture-reverse)

### Academic
- [XML Prompting as Grammar-Constrained Interaction — arXiv 2509.08182](https://arxiv.org/abs/2509.08182)
- [Tagging-Augmented Generation (TAG) — arXiv 2510.22956](https://arxiv.org/html/2510.22956v1)
- [StructEval — arXiv 2505.20139](https://arxiv.org/html/2505.20139v1)
- [Let Me Speak Freely (format restriction degrades reasoning) — arXiv 2408.02442](https://arxiv.org/html/2408.02442v1)

### Format comparison / warnings
- [Best nested data format for LLMs (improvingagents.com)](https://www.improvingagents.com/blog/best-nested-data-format/)
- [Agent Communication Protocols Survey — arXiv 2505.02279](https://arxiv.org/html/2505.02279v1)
- [Effective Prompt Engineering (XML for clarity)](https://medium.com/@TechforHumans/effective-prompt-engineering-mastering-xml-tags-for-clarity-precision-and-security-in-llms-992cae203fdc)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-transcripts-schema]] — JSON wire format (no XML)
- [[bagelcode-caching-strategy]] — sandwich XML's cache boundary
- [[bagelcode-frontier-orchestration-2026]] — MCP/A2A JSON-RPC alignment
- [[bagelcode-fault-tolerance-design]] — anti-injection handling for `<system-reminder>`
- [[bagelcode-agents-fixed]] — per-provider prompt format branching (Claude=XML, Codex=Markdown)
- [[geode-prompt-system]] / [[geode-prompt-templates]] — geode prompt sandwich pattern
