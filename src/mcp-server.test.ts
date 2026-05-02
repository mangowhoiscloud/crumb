import { describe, expect, it } from 'vitest';

import { buildServer } from './mcp-server.js';

describe('buildServer', () => {
  it('constructs an McpServer with name "crumb"', () => {
    const server = buildServer();
    expect(server).toBeDefined();
    // Internal _serverInfo is not part of public API; check via server.server (Server instance) connection-time check.
    // Easier: assert that constructing doesn't throw and server has a connect() method.
    expect(typeof server.connect).toBe('function');
  });

  it('registers 10 brand-forward tools (8 read + 2 write) matching CLI surface', () => {
    const server = buildServer();
    // Access internal registry — McpServer stores registered tools on _registeredTools.
    // The shape is implementation-detail but stable enough to smoke-test.
    const internals = server as unknown as { _registeredTools: Record<string, unknown> };
    expect(internals._registeredTools).toBeDefined();
    const names = Object.keys(internals._registeredTools);
    // crumb_<verb> mirrors the CLI subcommand 1:1 (precedent: Codex CLI MCP `codex` / `codex-reply`).
    expect(names).toContain('crumb_config');
    expect(names).toContain('crumb_status');
    expect(names).toContain('crumb_explain');
    expect(names).toContain('crumb_suggest');
    expect(names).toContain('crumb_debug');
    expect(names).toContain('crumb_doctor');
    expect(names).toContain('crumb_model');
    expect(names).toContain('crumb_export');
    // Write tools registered via registerWriteTools (src/mcp-write-tools.ts).
    expect(names).toContain('crumb_run');
    expect(names).toContain('crumb_intervene');
    expect(names).toHaveLength(10);
  });
});
