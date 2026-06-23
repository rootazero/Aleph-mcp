#!/usr/bin/env node
/** Entry point: build the MCP server, register all SiliconFlow media tools, serve over stdio. */

import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ToolDef } from "./tool-def.js";
import { imageTools } from "./images.js";
import { videoTools } from "./videos.js";
import { audioTools } from "./audio.js";
import { userTools } from "./user.js";

export const allTools: ToolDef[] = [...imageTools, ...videoTools, ...audioTools, ...userTools];

export function buildServer(): McpServer {
  const server = new McpServer({ name: "aleph-siliconflow-mcp", version: "0.2.0" });
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

const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
