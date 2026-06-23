/** Image generation and editing tools (POST /v1/images/generations). */

import { z } from "zod";
import type { ToolDef } from "./tool-def.js";
import { getClient, renderAssets, toImageField } from "./client.js";
import { imageSizeFor } from "./ratios.js";

export interface ImagePayloadOpts {
  prompt: string;
  model: string;
  imageSize?: string;
  negativePrompt?: string;
  batchSize?: number;
  seed?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  cfg?: number;
  images?: Record<string, string>;
}

export function buildImagePayload(o: ImagePayloadOpts): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: o.model,
    prompt: o.prompt,
    batch_size: o.batchSize ?? 1,
    num_inference_steps: o.numInferenceSteps ?? 20,
  };
  if (o.imageSize) payload.image_size = o.imageSize;
  if (o.negativePrompt) payload.negative_prompt = o.negativePrompt;
  if (o.seed !== undefined) payload.seed = o.seed;
  if (o.guidanceScale !== undefined) payload.guidance_scale = o.guidanceScale;
  if (o.cfg !== undefined) payload.cfg = o.cfg;
  for (const [key, value] of Object.entries(o.images ?? {})) {
    if (value) payload[key] = value;
  }
  return payload;
}

export function parseImageResponse(data: any): [string[], number | undefined] {
  const urls: string[] = (data.images ?? [])
    .filter((img: any) => img?.url)
    .map((img: any) => img.url as string);
  return [urls, data.seed];
}

async function generateImage(args: Record<string, any>) {
  const client = getClient();
  const payload = buildImagePayload({
    prompt: args.prompt,
    model: args.model,
    imageSize: imageSizeFor(args.aspect_ratio),
    negativePrompt: args.negative_prompt,
    batchSize: args.batch_size,
    seed: args.seed,
    numInferenceSteps: args.num_inference_steps,
    guidanceScale: args.guidance_scale,
    cfg: args.cfg,
  });
  const data = await client.requestJson("POST", "/images/generations", { json: payload });
  const [urls, outSeed] = parseImageResponse(data);
  const header = `Generated ${urls.length} image(s) with ${args.model} (seed=${outSeed})`;
  const text = await renderAssets(client, "image", urls, client.settings.imageDir, "image", header);
  return { content: [{ type: "text" as const, text }] };
}

async function editImage(args: Record<string, any>) {
  const client = getClient();
  const images: Record<string, string> = { image: toImageField(args.image) };
  if (args.image2) images.image2 = toImageField(args.image2);
  if (args.image3) images.image3 = toImageField(args.image3);
  const payload = buildImagePayload({
    prompt: args.prompt,
    model: args.model,
    negativePrompt: args.negative_prompt,
    seed: args.seed,
    images,
  });
  const data = await client.requestJson("POST", "/images/generations", { json: payload });
  const [urls, outSeed] = parseImageResponse(data);
  const header = `Edited image with ${args.model} (seed=${outSeed})`;
  const text = await renderAssets(client, "image", urls, client.settings.imageDir, "edit", header);
  return { content: [{ type: "text" as const, text }] };
}

export const imageTools: ToolDef[] = [
  {
    name: "generate_image",
    description: "Generate image(s) from a text prompt via SiliconFlow. Returns local paths and URLs.",
    inputSchema: {
      prompt: z.string(),
      model: z.string().default("Kwai-Kolors/Kolors"),
      aspect_ratio: z.string().default("1:1"),
      negative_prompt: z.string().optional(),
      batch_size: z.number().int().default(1),
      seed: z.number().int().optional(),
      num_inference_steps: z.number().int().default(20),
      guidance_scale: z.number().optional(),
      cfg: z.number().optional(),
    },
    handler: generateImage,
  },
  {
    name: "edit_image",
    description: "Edit / transform an image (local path or URL) with a text instruction.",
    inputSchema: {
      prompt: z.string(),
      image: z.string(),
      model: z.string().default("Qwen/Qwen-Image-Edit-2509"),
      image2: z.string().optional(),
      image3: z.string().optional(),
      negative_prompt: z.string().optional(),
      seed: z.number().int().optional(),
    },
    handler: editImage,
  },
];
