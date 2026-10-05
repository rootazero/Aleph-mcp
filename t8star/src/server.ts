// FastMCP server: registers all T8star media tools.
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateSpeech } from "./audio.js";
import { editImage, generateImage } from "./images.js";
import { generateMusic } from "./music.js";
import { getBalance, listModels } from "./models.js";
import { generateVideo, getVideoStatus } from "./videos.js";

// Single source of truth for the server version: read it from package.json so the
// MCP handshake can never drift from the published version. dist/server.js and
// src/server.ts both sit one level under the package root, so "../package.json"
// resolves identically at runtime and under vitest.
const version = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version as string;

export function createServer(): McpServer {
  const server = new McpServer({ name: "aleph-t8star-mcp", version });

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

  server.registerTool(
    "generate_video",
    {
      description:
        "Generate a video from a text prompt (T2V) or reference image (I2V) via t8star (POST /v1/videos, multipart). Models include sora_video2, veo3, veo3-fast, veo3-pro, wan-3.0-*, hailuo-h3-*, seedance*, kling, and minimax-h3-ow-*. Polls /v1/videos/{id} until completion, then saves the MP4 to T8STAR_VIDEO_DIR.",
      inputSchema: {
        model: z.string().describe("Video model id, e.g. veo3, veo3-fast, wan-3.0-i2v"),
        prompt: z.string().describe("Text prompt describing the video"),
        seconds: z.string().optional().describe("Clip length, e.g. '5' or '10'"),
        size: z.string().optional().describe("Resolution like '1280x720' or '720x1280'"),
        private: z.boolean().optional().describe("Mark the video as private (model-dependent)"),
        seed: z.string().optional().describe("Optional seed for reproducibility"),
        image: z.string().optional().describe("For I2V models: source image (local path, URL, or data URI)"),
      },
    },
    async (args) => ({ content: [{ type: "text" as const, text: await generateVideo(args) }] }),
  );

  server.registerTool(
    "get_video",
    {
      description:
        "Poll the status of a previously submitted t8star video task. Pass the task_id returned by generate_video. Returns current status, and when completed returns the local MP4 path (if T8STAR_VIDEO_DIR is set) or the remote URL.",
      inputSchema: {
        task_id: z.string().describe("The video task id returned by generate_video"),
      },
    },
    async (args) => ({ content: [{ type: "text" as const, text: await getVideoStatus(args) }] }),
  );

  server.registerTool(
    "generate_music",
    {
      description:
        "Generate music via t8star Suno (POST /suno/generate). Submits the prompt and polls /suno/feed/{clip_ids} until completion. Saves audio clips to T8STAR_MUSIC_DIR (defaults to T8STAR_AUDIO_DIR).",
      inputSchema: {
        prompt: z.string().describe("Music generation prompt / lyrics"),
        tags: z.string().optional().describe("Style tags, comma-separated (e.g. 'pop, upbeat, female vocal')"),
        mv: z.string().optional().describe("Music version / variant (model-dependent)"),
        title: z.string().optional().describe("Title for the generated track"),
        seed: z.string().optional().describe("Optional seed for reproducibility"),
      },
    },
    async (args) => ({ content: [{ type: "text" as const, text: await generateMusic(args) }] }),
  );

  return server;
}
