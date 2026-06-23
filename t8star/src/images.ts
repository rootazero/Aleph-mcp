// Image generation (POST /v1/images/generations) and editing (POST /v1/images/edits).
import { tmpdir } from "node:os";
import { getClient, type T8starClient } from "./client.js";

export interface ImageGenParams {
  prompt: string;
  model: string;
  size?: string | null;
  n?: number;
  quality?: string | null;
  responseFormat?: string | null;
}

export function buildImagePayload(p: ImageGenParams): Record<string, unknown> {
  const payload: Record<string, unknown> = { model: p.model, prompt: p.prompt, n: p.n ?? 1 };
  if (p.size) payload.size = p.size;
  if (p.quality) payload.quality = p.quality;
  if (p.responseFormat) payload.response_format = p.responseFormat;
  return payload;
}

export type ImageItem = ["url" | "b64", string];

export function parseImageResponse(data: any): ImageItem[] {
  const items: ImageItem[] = [];
  for (const entry of data?.data ?? []) {
    if (entry?.url) items.push(["url", entry.url]);
    else if (entry?.b64_json) items.push(["b64", entry.b64_json]);
  }
  return items;
}

export async function renderImageItems(
  client: T8starClient,
  items: ImageItem[],
  saveDir: string | undefined,
  prefix: string,
  header: string,
): Promise<string> {
  if (items.length === 0) return `${header}: no image returned by the API.`;
  const lines = [`${header}:`];
  let i = 0;
  for (const [kind, value] of items) {
    i += 1;
    if (kind === "url") {
      if (saveDir) {
        const local = await client.download(value, saveDir, prefix);
        lines.push(`  ${i}. ${local}  (source: ${value})`);
      } else {
        lines.push(`  ${i}. ${value}  (remote URL, expires soon — set T8STAR_IMAGE_DIR to keep it)`);
      }
    } else {
      // base64 must be saved to disk to be usable
      const target = saveDir ?? tmpdir();
      const local = client.saveBinary(Buffer.from(value, "base64"), target, ".png", prefix);
      const note = saveDir ? "" : "  (no save dir set — saved to temp; set T8STAR_IMAGE_DIR)";
      lines.push(`  ${i}. ${local}  (decoded from base64)${note}`);
    }
  }
  return lines.join("\n");
}

export async function generateImage(args: {
  prompt: string;
  model?: string;
  size?: string;
  n?: number;
  quality?: string;
  response_format?: string;
}): Promise<string> {
  const client = getClient();
  const model = args.model ?? "gpt-image-2";
  const payload = buildImagePayload({
    prompt: args.prompt,
    model,
    size: args.size ?? "1024x1024",
    n: args.n ?? 1,
    quality: args.quality,
    responseFormat: args.response_format,
  });
  const data = await client.requestJson("POST", "/images/generations", { json: payload });
  const items = parseImageResponse(data);
  const header = `Generated ${items.length} image(s) with ${model}`;
  return renderImageItems(client, items, client.settings.imageDir, "image", header);
}

export async function editImage(args: {
  prompt: string;
  image: string;
  model?: string;
  size?: string;
  n?: number;
  mask?: string;
}): Promise<string> {
  const client = getClient();
  const model = args.model ?? "gpt-image-2";
  const { bytes, filename } = await client.loadImageBytes(args.image);
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(bytes)]), filename);
  form.append("model", model);
  form.append("prompt", args.prompt);
  form.append("n", String(args.n ?? 1));
  form.append("size", args.size ?? "auto");
  if (args.mask) {
    const m = await client.loadImageBytes(args.mask);
    form.append("mask", new Blob([new Uint8Array(m.bytes)]), m.filename);
  }
  const data = await client.requestMultipart("/images/edits", form);
  const items = parseImageResponse(data);
  const header = `Edited image with ${model}`;
  return renderImageItems(client, items, client.settings.imageDir, "edit", header);
}
