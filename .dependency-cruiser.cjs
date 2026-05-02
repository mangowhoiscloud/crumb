/**
 * dependency-cruiser config — enforces Crumb's architecture invariants
 * (AGENTS.md §"Architecture invariants") at lint time.
 *
 * Each rule below maps to a specific invariant or 2026 frontier evidence:
 * - reducer-purity / state-purity → invariant 2 ("Pure reducer for state.
 *   src/reducer/ is pure (no I/O, no time, no randomness).")
 * - no-circular → cycle detection (knip + dep-cruiser overlap; we run both
 *   because each has different blind spots)
 *
 * Frontier rationale: MSR '26 *Beyond the Prompt* (arXiv 2512.18925)
 * showed statically-typed projects with strong layer constraints need
 * less prompt-context budget — encoding architecture as enforced lint
 * rules pays the LLM-readability dividend and prevents drift.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular dependencies break tree-shaking, confuse static analysis, and ' +
        'force LLMs to read both files to understand either. See knip docs / ' +
        'tkdodo barrel-files essay (2024).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'reducer-purity',
      severity: 'error',
      comment:
        'AGENTS.md invariant 2: src/reducer/ is pure (no I/O, no time, no ' +
        'randomness). It must not import side-effecting modules. Allowed: ' +
        'protocol/types, state/types, effects/types, validator (also pure).',
      from: { path: '^src/reducer/' },
      to: {
        path: '^src/(dispatcher|adapters|transcript|loop|inbox|exporter|cli|index|tui|summary|session|mcp-server|paths)',
      },
    },
    {
      name: 'state-purity',
      severity: 'error',
      comment:
        'src/state/ holds the pure data shape derivable from the transcript. ' +
        'It must not depend on side-effecting modules.',
      from: { path: '^src/state/' },
      to: {
        path: '^src/(dispatcher|adapters|transcript|loop|inbox|exporter|cli|index|tui|summary|session|mcp-server|paths)',
      },
    },
    {
      name: 'protocol-types-purity',
      severity: 'error',
      comment:
        'src/protocol/types.ts is the schema-mirror type vocabulary. It must ' +
        'have zero dependencies on the rest of the codebase.',
      from: { path: '^src/protocol/types\\.ts$' },
      to: { path: '^src/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '(\\.test\\.ts$|dist|sessions|^packages/)',
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
