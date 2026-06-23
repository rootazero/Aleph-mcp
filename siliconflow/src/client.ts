/** Config, error handling, and pure asset helpers. (HTTP client is added in Task 3.) */

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

export const DEFAULT_API_BASE = "https://api.siliconflow.cn/v1";
export const REQUEST_TIMEOUT_MS = 300_000;

/** User-facing error from the SiliconFlow API or local IO. */
export class SiliconFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiliconFlowError";
  }
}

export class Settings {
  constructor(
    public readonly apiKey: string,
    public readonly apiBase: string,
    public readonly imageDir: string | undefined,
    public readonly audioDir: string | undefined,
  ) {}

  static fromEnv(): Settings {
    const imageDir = process.env.SILICONFLOW_IMAGE_DIR || undefined;
    const audioDir = process.env.SILICONFLOW_AUDIO_DIR || imageDir;
    const apiBase = (process.env.SILICONFLOW_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
    const apiKey = (process.env.SILICONFLOW_API_KEY || "").trim();
    return new Settings(apiKey, apiBase, imageDir, audioDir);
  }
}

/** Best-effort human-readable message from an error response body (pure). */
export function extractApiError(statusCode: number, body: string): string {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      const err = (parsed as Record<string, any>).error;
      const errMsg = err && typeof err === "object" ? err.message : err;
      message = (parsed as Record<string, any>).message || errMsg || body;
    }
  } catch {
    // non-JSON body: keep raw text
  }
  return `SiliconFlow API error ${statusCode}: ${message}`;
}

/** Derive a file extension from a URL path (pure). */
export function extFromUrl(url: string, def = ".png"): string {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = url.toLowerCase();
  }
  for (const ext of [".png", ".jpg", ".jpeg", ".mp4", ".webp"]) {
    if (path.endsWith(ext)) return ext;
  }
  return def;
}

/** Deterministic asset filename (pure). */
export function buildFilename(prefix: string, ext: string, stamp: number): string {
  const dotExt = ext.startsWith(".") ? ext : `.${ext}`;
  return `${prefix}_${stamp}${dotExt}`;
}

/** True if value is an http(s) URL or a data URI (pure). */
export function looksRemote(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  );
}

/** Pass through a URL/data-URI; base64-encode a local file path. */
export function toImageField(value: string): string {
  if (looksRemote(value)) return value;
  if (!existsSync(value) || !statSync(value).isFile()) {
    throw new SiliconFlowError(`image file not found: ${value}`);
  }
  const data = readFileSync(value).toString("base64");
  const suffix = extname(value).replace(/^\./, "") || "png";
  return `data:image/${suffix};base64,${data}`;
}
