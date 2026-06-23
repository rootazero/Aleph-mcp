import type { ZodRawShape } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** A registrable MCP tool: name, description, Zod input shape, and async handler. */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (args: Record<string, any>) => Promise<CallToolResult>;
}
