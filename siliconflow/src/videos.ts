/** Video generation tools (POST /v1/video/submit + /v1/video/status). */

import { z } from "zod";
import type { ToolDef } from "./tool-def.js";
import { getClient, renderAssets, toImageField, SiliconFlowError } from "./client.js";
import { videoSizeFor } from "./ratios.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface VideoPayloadOpts {
  prompt: string;
  model: string;
  imageSize: string;
  image?: string;
  negativePrompt?: string;
  seed?: number;
}

export function buildVideoPayload(o: VideoPayloadOpts): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: o.model,
    prompt: o.prompt,
    image_size: o.imageSize,
  };
  if (o.image) payload.image = o.image;
  if (o.negativePrompt) payload.negative_prompt = o.negativePrompt;
  if (o.seed !== undefined) payload.seed = o.seed;
  return payload;
}

export function parseSubmitResponse(data: any): string {
  const requestId = data.requestId;
  if (!requestId) {
    throw new SiliconFlowError(`unexpected video submit response: ${JSON.stringify(data)}`);
  }
  return requestId;
}

export function parseStatusResponse(data: any): { status: string; reason?: string; urls: string[] } {
  const results = data.results ?? {};
  return {
    status: data.status ?? "Unknown",
    reason: data.reason,
    urls: (results.videos ?? []).filter((v: any) => v?.url).map((v: any) => v.url as string),
  };
}

async function submitVideoGeneration(args: Record<string, any>) {
  const client = getClient();
  const payload = buildVideoPayload({
    prompt: args.prompt,
    model: args.model,
    imageSize: videoSizeFor(args.aspect_ratio),
    image: args.image ? toImageField(args.image) : undefined,
    negativePrompt: args.negative_prompt,
    seed: args.seed,
  });
  const data = await client.requestJson("POST", "/video/submit", { json: payload });
  const requestId = parseSubmitResponse(data);
  return {
    content: [
      { type: "text" as const, text: `Video job submitted. requestId: ${requestId}\nPoll with get_video_status.` },
    ],
  };
}

async function getVideoStatus(args: Record<string, any>) {
  const client = getClient();
  const data = await client.requestJson("POST", "/video/status", {
    json: { requestId: args.request_id },
  });
  const status = parseStatusResponse(data);
  if (status.status === "Succeed") {
    const text = await renderAssets(
      client,
      "video",
      status.urls,
      client.settings.imageDir,
      "video",
      `Video ready (requestId ${args.request_id})`,
    );
    return { content: [{ type: "text" as const, text }] };
  }
  if (status.status === "Failed") {
    return {
      content: [
        { type: "text" as const, text: `Video generation failed: ${status.reason || "unknown reason"}` },
      ],
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `Video status: ${status.status} (still processing). Poll again with requestId ${args.request_id}.`,
      },
    ],
  };
}

async function generateVideo(args: Record<string, any>) {
  const client = getClient();
  const payload = buildVideoPayload({
    prompt: args.prompt,
    model: args.model,
    imageSize: videoSizeFor(args.aspect_ratio),
    image: args.image ? toImageField(args.image) : undefined,
    negativePrompt: args.negative_prompt,
    seed: args.seed,
  });
  const submit = await client.requestJson("POST", "/video/submit", { json: payload });
  const requestId = parseSubmitResponse(submit);
  const maxWait: number = args.max_wait_seconds;
  const pollInterval: number = args.poll_interval_seconds;
  let waited = 0;
  while (waited < maxWait) {
    await sleep(pollInterval * 1000);
    waited += pollInterval;
    const data = await client.requestJson("POST", "/video/status", { json: { requestId } });
    const status = parseStatusResponse(data);
    if (status.status === "Succeed") {
      const text = await renderAssets(
        client,
        "video",
        status.urls,
        client.settings.imageDir,
        "video",
        `Generated video with ${args.model}`,
      );
      return { content: [{ type: "text" as const, text }] };
    }
    if (status.status === "Failed") {
      return {
        content: [
          { type: "text" as const, text: `Video generation failed: ${status.reason || "unknown reason"}` },
        ],
      };
    }
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `Video still processing after ${maxWait}s. Poll later with get_video_status, requestId: ${requestId}.`,
      },
    ],
  };
}

export const videoTools: ToolDef[] = [
  {
    name: "generate_video",
    description: "Generate a video and poll until done (with a timeout). Returns the saved path / URL.",
    inputSchema: {
      prompt: z.string(),
      model: z.string().default("Wan-AI/Wan2.2-T2V-A14B"),
      aspect_ratio: z.string().default("16:9"),
      image: z.string().optional(),
      negative_prompt: z.string().optional(),
      seed: z.number().int().optional(),
      max_wait_seconds: z.number().int().default(600),
      poll_interval_seconds: z.number().int().default(5),
    },
    handler: generateVideo,
  },
  {
    name: "submit_video_generation",
    description: "Submit a video generation job; returns a requestId to poll with get_video_status.",
    inputSchema: {
      prompt: z.string(),
      model: z.string().default("Wan-AI/Wan2.2-T2V-A14B"),
      aspect_ratio: z.string().default("16:9"),
      image: z.string().optional(),
      negative_prompt: z.string().optional(),
      seed: z.number().int().optional(),
    },
    handler: submitVideoGeneration,
  },
  {
    name: "get_video_status",
    description: "Check a video job's status; on success returns the saved path / URL.",
    inputSchema: {
      request_id: z.string(),
    },
    handler: getVideoStatus,
  },
];
