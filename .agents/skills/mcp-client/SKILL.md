---
name: mcp-client
description: Connect to external MCP servers with progressive disclosure. Use when the user wants to inspect, select, or call MCP tools without loading every tool schema into the active context.
---

# MCP Client

Use this skill when the task depends on an MCP server such as Zapier, GitHub, or another external integration.

## Workflow

1. Identify the target MCP server and the exact outcome the user wants.
2. Load only the relevant server config and tool definitions.
3. Inspect the tool schema for the selected action, not the full server surface area.
4. Call the tool with minimal arguments, then summarize the result and any operational gotchas.
5. Record stable setup notes in a shared project doc if the same integration will be reused.

## Context Discipline

- Do not dump full tool catalogs into the main prompt.
- Load tool schemas on demand.
- Prefer naming the selected tool, required inputs, and failure modes over copying raw schemas.
