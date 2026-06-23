/** Config, error handling, and pure asset helpers. (HTTP client is added in Task 3.) */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

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

async function fetchWithTimeout(url: string | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface RequestOptions {
  json?: unknown;
  params?: Record<string, string>;
}

export class SiliconFlowClient {
  constructor(public readonly settings: Settings) {
    if (!settings.apiKey) {
      throw new SiliconFlowError("SILICONFLOW_API_KEY is not set");
    }
  }

  private get headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.settings.apiKey}` };
  }

  private buildUrl(path: string): string {
    return `${this.settings.apiBase}/${path.replace(/^\//, "")}`;
  }

  async requestJson(method: string, path: string, opts: RequestOptions = {}): Promise<any> {
    const url = new URL(this.buildUrl(path));
    if (opts.params) {
      for (const [k, v] of Object.entries(opts.params)) {
        if (v != null) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = { ...this.headers };
    let body: string | undefined;
    if (opts.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const resp = await fetchWithTimeout(url, { method, headers, body });
    const text = await resp.text();
    if (resp.status >= 400) {
      throw new SiliconFlowError(extractApiError(resp.status, text));
    }
    return JSON.parse(text);
  }

  async requestBinary(method: string, path: string, opts: RequestOptions = {}): Promise<Buffer> {
    const headers: Record<string, string> = { ...this.headers };
    let body: string | undefined;
    if (opts.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const resp = await fetchWithTimeout(this.buildUrl(path), { method, headers, body });
    if (resp.status >= 400) {
      const text = await resp.text();
      throw new SiliconFlowError(extractApiError(resp.status, text));
    }
    return Buffer.from(await resp.arrayBuffer());
  }

  /** Download asset to saveDir; on any failure return the original URL. */
  async download(url: string, saveDir: string, prefix: string): Promise<string> {
    try {
      mkdirSync(saveDir, { recursive: true });
      const resp = await fetchWithTimeout(url, { method: "GET" });
      if (!resp.ok) throw new SiliconFlowError(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const name = buildFilename(prefix, extFromUrl(url), Math.floor(Date.now() / 1000));
      const filePath = resolve(join(saveDir, name));
      writeFileSync(filePath, buf);
      return filePath;
    } catch {
      return url;
    }
  }

  saveBinary(content: Buffer, saveDir: string, ext: string, prefix: string): string {
    mkdirSync(saveDir, { recursive: true });
    const name = buildFilename(prefix, ext, Math.floor(Date.now() / 1000));
    const filePath = resolve(join(saveDir, name));
    writeFileSync(filePath, content);
    return filePath;
  }
}

let _client: SiliconFlowClient | undefined;

/** Lazy singleton built from env (avoids import-time env reads). */
export function getClient(): SiliconFlowClient {
  if (!_client) _client = new SiliconFlowClient(Settings.fromEnv());
  return _client;
}

/** Download each url (if saveDir set) and format an LLM-readable summary. */
export async function renderAssets(
  client: SiliconFlowClient,
  kind: string,
  urls: string[],
  saveDir: string | undefined,
  prefix: string,
  header: string,
): Promise<string> {
  if (urls.length === 0) {
    return `${header}: no ${kind} returned by the API.`;
  }
  const lines = [`${header}:`];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (saveDir) {
      const local = await client.download(url, saveDir, prefix);
      lines.push(`  ${i + 1}. ${local}  (source: ${url})`);
    } else {
      lines.push(`  ${i + 1}. ${url}  (remote URL, expires soon — set a save dir to keep it)`);
    }
  }
  return lines.join("\n");
}
