// FastMCP server: registers all T8star media tools.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateSpeech } from "./audio.js";
import { editImage, generateImage } from "./images.js";
import { getBalance, listModels } from "./models.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "aleph-t8star-mcp", version: "0.1.0" });

  server.registerTool(
    "generate_image",
    {
      description:
        "Generate image(s) from a text prompt via t8star. model e.g. gpt-image-2 / dall-e-3 / flux-2-pro / nano-banana-2. size e.g. 1024x1024 / 1536x1024 / 1024x1536 / auto. Returns local paths and/or URLs.",
      inputSchema: {
        prompt: z.string().describe("Text prompt"),
        model: z.string().default("gpt-image-2"),
        size: z.string().default("1024x1024"),
        n: z.number().int().min(1).max(10).default(1),
        quality: z.string().optional(),
        response_format: z.string().optional(),
      },
    },
    async (args) => ({ content: [{ type: "text" as const, text: await generateImage(args) }] }),
  );

  server.registerTool(
    "edit_image",
    {
      description:
        "Edit an image (local path or URL) with a text instruction via t8star (POST /v1/images/edits, multipart). Returns local paths and/or URLs.",
      inputSchema: {
        prompt: z.string(),
        image: z.string().describe("Local file path, URL, or data URI of the source image"),
        model: z.string().default("gpt-image-2"),
        size: z.string().default("auto"),
        n: z.number().int().min(1).max(10).default(1),
        mask: z.string().optional().describe("Optional mask image (path/URL) marking the editable region"),
      },
    },
    async (args) => ({ content: [{ type: "text" as const, text: await editImage(args) }] }),
  );

  server.registerTool(
    "generate_speech",
    {
      description:
        "Synthesize speech from text via t8star. model e.g. tts-1 / tts-1-hd / gpt-4o-mini-tts. voice e.g. alloy / echo / fable / onyx / nova / shimmer. Returns the saved audio path.",
      inputSchema: {
        input: z.string(),
        model: z.string().default("tts-1"),
        voice: z.string().default("alloy"),
        response_format: z.string().default("mp3"),
        speed: z.number().min(0.25).max(4.0).default(1.0),
      },
    },
    async (args) => ({ content: [{ type: "text" as const, text: await generateSpeech(args) }] }),
  );

  server.registerTool(
    "list_models",
    {
      description:
        "List available t8star models. Filter by owned_by (e.g. openai/vertex-ai/bfl), endpoint_type (openai/anthropic), or query (substring of model id, e.g. 'image', 'sora', 'tts').",
      inputSchema: {
        owned_by: z.string().optional(),
        endpoint_type: z.string().optional(),
        query: z.string().optional(),
      },
    },
    async (args) => ({ content: [{ type: "text" as const, text: await listModels(args) }] }),
  );

  server.registerTool(
    "get_balance",
    {
      description: "Show the t8star account spend and quota (used / limit / remaining USD).",
      inputSchema: {},
    },
    async () => ({ content: [{ type: "text" as const, text: await getBalance() }] }),
  );

  return server;
}
