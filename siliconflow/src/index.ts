#!/usr/bin/env node
/** Entry point: build the MCP server, register all SiliconFlow media tools, serve over stdio. */

import { fileURLToPath } from "node:url";
import { readFileSync, realpathSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ToolDef } from "./tool-def.js";
import { imageTools } from "./images.js";
import { videoTools } from "./videos.js";
import { audioTools } from "./audio.js";
import { userTools } from "./user.js";

export const allTools: ToolDef[] = [...imageTools, ...videoTools, ...audioTools, ...userTools];

// Single source of truth for the server version: read it from package.json so the
// MCP handshake can never drift from the published version. dist/index.js and
// src/index.ts both sit one level under the package root, so "../package.json"
// resolves identically at runtime and under vitest.
const version = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version as string;

export function buildServer(): McpServer {
  const server = new McpServer({ name: "aleph-siliconflow-mcp", version });
  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      tool.handler,
    );
  }
  return server;
}

export async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Detect direct execution symlink-safe: an npm/npx `bin` shim runs this file
// through a symlink in node_modules/.bin, so process.argv[1] is that symlink,
// not the real dist/index.js. Resolve both before comparing — otherwise main()
// never runs under npx and the server exits silently. Importers (tests) see a
// mismatch and stay side-effect-free.
const isEntry = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
