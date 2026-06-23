// Config, native-fetch HTTP client, error handling, and local asset saving.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

export const DEFAULT_API_BASE = "https://ai.t8star.org/v1";
export const REQUEST_TIMEOUT_MS = 300_000;
const AUDIO_EXTENSIONS = new Set(["mp3", "opus", "aac", "flac", "wav", "pcm"]);

export class T8starError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "T8starError";
  }
}

export interface Settings {
  apiKey: string;
  apiBase: string;
  imageDir?: string;
  audioDir?: string;
}

export function settingsFromEnv(): Settings {
  const imageDir = process.env.T8STAR_IMAGE_DIR || undefined;
  const audioDir = process.env.T8STAR_AUDIO_DIR || imageDir;
  const apiBase = (process.env.T8STAR_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
  return {
    apiKey: (process.env.T8STAR_API_KEY || "").trim(),
    apiBase,
    imageDir,
    audioDir,
  };
}

export function extractApiError(status: number, body: string): string {
  let message = body;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      const err = parsed.error as { message?: string } | string | undefined;
      const errMsg = err && typeof err === "object" ? err.message : err;
      message = (parsed.message as string) || errMsg || body;
    }
  } catch {
    // body is not JSON; keep as-is
  }
  return `T8star API error ${status}: ${message}`;
}

export function extFromUrl(url: string, def = ".png"): string {
  let path = url.toLowerCase();
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    // not a full URL; use the raw string
  }
  for (const ext of [".png", ".jpg", ".jpeg", ".mp4", ".webp"]) {
    if (path.endsWith(ext)) return ext;
  }
  return def;
}

export function buildFilename(prefix: string, ext: string, stamp: number): string {
  const e = ext.startsWith(".") ? ext : `.${ext}`;
  return `${prefix}_${stamp}${e}`;
}

export function extForFormat(responseFormat: string): string {
  return AUDIO_EXTENSIONS.has(responseFormat) ? responseFormat : "mp3";
}

export class T8starClient {
  readonly settings: Settings;

  constructor(settings: Settings) {
    if (!settings.apiKey) throw new T8starError("T8STAR_API_KEY is not set");
    this.settings = settings;
  }

  private url(path: string): string {
    return `${this.settings.apiBase}/${path.replace(/^\/+/, "")}`;
  }

  private get authHeader(): Record<string, string> {
    return { Authorization: `Bearer ${this.settings.apiKey}` };
  }

  async requestJson(method: string, path: string, opts: { json?: unknown } = {}): Promise<any> {
    const resp = await fetch(this.url(path), {
      method,
      headers: { ...this.authHeader, ...(opts.json ? { "Content-Type": "application/json" } : {}) },
      body: opts.json ? JSON.stringify(opts.json) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!resp.ok) throw new T8starError(extractApiError(resp.status, await resp.text()));
    return resp.json();
  }

  async requestBinary(method: string, path: string, opts: { json?: unknown } = {}): Promise<Buffer> {
    const resp = await fetch(this.url(path), {
      method,
      headers: { ...this.authHeader, ...(opts.json ? { "Content-Type": "application/json" } : {}) },
      body: opts.json ? JSON.stringify(opts.json) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!resp.ok) throw new T8starError(extractApiError(resp.status, await resp.text()));
    return Buffer.from(await resp.arrayBuffer());
  }

  async requestMultipart(path: string, form: FormData): Promise<any> {
    // Do NOT set Content-Type; fetch derives the multipart boundary from the FormData body.
    const resp = await fetch(this.url(path), {
      method: "POST",
      headers: this.authHeader,
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!resp.ok) throw new T8starError(extractApiError(resp.status, await resp.text()));
    return resp.json();
  }

  async download(url: string, saveDir: string, prefix: string): Promise<string> {
    try {
      mkdirSync(saveDir, { recursive: true });
      const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const name = buildFilename(prefix, extFromUrl(url), Math.floor(Date.now() / 1000));
      const filePath = resolve(saveDir, name);
      writeFileSync(filePath, buf);
      return filePath;
    } catch {
      return url; // graceful degradation: keep the remote URL
    }
  }

  saveBinary(content: Buffer, saveDir: string, ext: string, prefix: string): string {
    mkdirSync(saveDir, { recursive: true });
    const name = buildFilename(prefix, ext, Math.floor(Date.now() / 1000));
    const filePath = resolve(saveDir, name);
    writeFileSync(filePath, content);
    return filePath;
  }

  async loadImageBytes(value: string): Promise<{ bytes: Buffer; filename: string }> {
    if (value.startsWith("data:")) {
      const b64 = value.split(",", 2)[1] ?? "";
      return { bytes: Buffer.from(b64, "base64"), filename: "image.png" };
    }
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const resp = await fetch(value, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!resp.ok) throw new T8starError(`failed to fetch image: ${value} (status ${resp.status})`);
      const name = basename(new URL(value).pathname) || "image.png";
      return { bytes: Buffer.from(await resp.arrayBuffer()), filename: name };
    }
    if (!existsSync(value)) throw new T8starError(`image file not found: ${value}`);
    return { bytes: readFileSync(value), filename: basename(value) };
  }
}

let _client: T8starClient | null = null;

export function getClient(): T8starClient {
  if (_client === null) _client = new T8starClient(settingsFromEnv());
  return _client;
}
