// Config, native-fetch HTTP client, error handling, and local asset saving.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

export const DEFAULT_API_BASE = "https://ai.t8star.org/v1";
export const REQUEST_TIMEOUT_MS = 300_000;
const AUDIO_EXTENSIONS = new Set(["mp3", "opus", "aac", "flac", "wav", "pcm"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov"]);
const DEFAULT_VIDEO_POLL_INTERVAL_MS = 5_000;
const DEFAULT_VIDEO_POLL_TIMEOUT_MS = 20 * 60_000; // 20 minutes — videos can be slow

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
  videoDir?: string;
  musicDir?: string;
  videoPollIntervalMs: number;
  videoPollTimeoutMs: number;
}

export function settingsFromEnv(): Settings {
  const imageDir = process.env.T8STAR_IMAGE_DIR || undefined;
  const audioDir = process.env.T8STAR_AUDIO_DIR || imageDir;
  const videoDir = process.env.T8STAR_VIDEO_DIR || undefined;
  const musicDir = process.env.T8STAR_MUSIC_DIR || audioDir;
  const apiBase = (process.env.T8STAR_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
  return {
    apiKey: (process.env.T8STAR_API_KEY || "").trim(),
    apiBase,
    imageDir,
    audioDir,
    videoDir,
    musicDir,
    videoPollIntervalMs: intFromEnv("T8STAR_VIDEO_POLL_INTERVAL_MS", DEFAULT_VIDEO_POLL_INTERVAL_MS),
    videoPollTimeoutMs: intFromEnv("T8STAR_VIDEO_POLL_TIMEOUT_MS", DEFAULT_VIDEO_POLL_TIMEOUT_MS),
  };
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function extForVideoUrl(url: string, def = ".mp4"): string {
  let path = url.toLowerCase();
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    // not a full URL; use the raw string
  }
  for (const ext of [".mp4", ".webm", ".mov"]) {
    if (path.endsWith(ext)) return ext;
  }
  return def;
}

export function extIsVideo(ext: string): boolean {
  return VIDEO_EXTENSIONS.has(ext.replace(/^\./, "").toLowerCase());
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

  async uploadFile(value: string): Promise<string> {
    const { bytes, filename } = await this.loadImageBytes(value);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)]), filename);
    const resp = await this.requestMultipart("/files", form);
    return String(resp?.url ?? resp?.file_url ?? resp?.data?.url ?? "");
  }

  async submitVideo(
    params: {
      model: string;
      prompt: string;
      seconds?: string | number;
      size?: string;
      private?: boolean;
      seed?: string | number;
    },
    images?: Array<{ bytes: Buffer; filename: string }>,
  ): Promise<{ id: string }> {
    const form = new FormData();
    form.append("model", params.model);
    form.append("prompt", params.prompt);
    if (params.seconds !== undefined) form.append("seconds", String(params.seconds));
    if (params.size) form.append("size", params.size);
    if (params.private !== undefined) form.append("private", String(params.private));
    if (params.seed !== undefined) form.append("seed", String(params.seed));
    if (images && images.length) {
      for (const img of images) {
        form.append("input_reference", new Blob([new Uint8Array(img.bytes)]), img.filename);
      }
    }
    const resp = await this.requestMultipart("/videos", form);
    return { id: String(resp?.id ?? resp?.task_id ?? "") };
  }

  async pollVideo(taskId: string): Promise<{
    status: string;
    progress?: number;
    video_url?: string;
    fail_reason?: string;
    seed?: string | number;
  }> {
    const resp = await this.requestJson("GET", `/videos/${encodeURIComponent(taskId)}`);
    return {
      status: String(resp?.status ?? "unknown"),
      progress: typeof resp?.progress === "number" ? resp.progress : undefined,
      video_url: resp?.video_url ? String(resp.video_url) : undefined,
      fail_reason: resp?.fail_reason ? String(resp.fail_reason) : undefined,
      seed: resp?.seed,
    };
  }

  async submitMusic(params: {
    prompt: string;
    tags?: string;
    mv?: string;
    title?: string;
    seed?: string | number;
  }): Promise<{ id: string; clips: Array<{ id: string }> }> {
    const resp = await this.requestJson("POST", "/suno/generate", {
      json: {
        prompt: params.prompt,
        tags: params.tags,
        mv: params.mv,
        title: params.title,
        seed: params.seed,
      },
    });
    const id = String(resp?.id ?? resp?.task_id ?? "");
    const rawClips = Array.isArray(resp?.clips)
      ? resp.clips
      : Array.isArray(resp?.data)
        ? resp.data
        : [];
    const clips = rawClips
      .map((c: { id?: string; clip_id?: string }) => ({ id: String(c?.id ?? c?.clip_id ?? "") }))
      .filter((c: { id: string }) => c.id);
    return { id, clips };
  }

  async pollMusicFeed(clipIds: string[]): Promise<Array<Record<string, unknown>>> {
    if (!clipIds.length) return [];
    const csv = encodeURIComponent(clipIds.join(","));
    const resp = await this.requestJson("GET", `/suno/feed/${csv}`);
    return Array.isArray(resp) ? resp : Array.isArray(resp?.data) ? resp.data : [];
  }

  async downloadVideo(url: string, saveDir: string, prefix: string): Promise<string> {
    try {
      mkdirSync(saveDir, { recursive: true });
      const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const name = buildFilename(prefix, extForVideoUrl(url), Math.floor(Date.now() / 1000));
      const filePath = resolve(saveDir, name);
      writeFileSync(filePath, buf);
      return filePath;
    } catch {
      return url;
    }
  }

  async submitFlux(params: {
    model: "flux-2-max" | "flux-2-pro" | "flux-2-flex";
    prompt: string;
    width?: number;
    height?: number;
    seed?: number;
    imagePrompt?: string;
  }): Promise<{ id: string }> {
    const payload: Record<string, unknown> = { prompt: params.prompt };
    if (typeof params.width === "number") payload.width = params.width;
    if (typeof params.height === "number") payload.height = params.height;
    if (typeof params.seed === "number" && params.seed >= 0) payload.seed = params.seed;
    if (params.imagePrompt) {
      const { bytes } = await this.loadImageBytes(params.imagePrompt);
      payload.input_image = bytes.toString("base64");
    }
    const resp = await this.requestJson("POST", `/bfl/v1/${params.model}`, { json: payload });
    return { id: String(resp?.id ?? "") };
  }

  async pollFlux(taskId: string): Promise<{
    status: string;
    image_url?: string;
    seed?: number;
    error?: string;
    raw: Record<string, unknown>;
  }> {
    const resp = await this.requestJson(
      "GET",
      `/bfl/v1/get_result?id=${encodeURIComponent(taskId)}`,
    );
    const status = String(resp?.status ?? "unknown");
    const result = (resp?.result as Record<string, unknown> | undefined) ?? {};
    return {
      status,
      image_url: result?.sample ? String(result.sample) : undefined,
      seed: typeof result?.seed === "number" ? (result.seed as number) : undefined,
      error: resp?.details ? String(resp.details) : undefined,
      raw: resp ?? {},
    };
  }

  async submitAsyncEdit(params: {
    image: string;
    prompt: string;
    model?: string;
    size?: string;
    n?: number;
    mask?: string;
  }): Promise<{ id: string }> {
    const { bytes, filename } = await this.loadImageBytes(params.image);
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(bytes)]), filename);
    form.append("model", params.model ?? "gpt-image-2");
    form.append("prompt", params.prompt);
    form.append("n", String(params.n ?? 1));
    form.append("size", params.size ?? "auto");
    if (params.mask) {
      const m = await this.loadImageBytes(params.mask);
      form.append("mask", new Blob([new Uint8Array(m.bytes)]), m.filename);
    }
    const resp = await this.requestMultipart("/images/edits?async=true", form);
    return { id: String(resp?.id ?? resp?.task_id ?? "") };
  }

  async pollEdit(taskId: string): Promise<{
    status: string;
    data: Array<{ url?: string; b64_json?: string }>;
    fail_reason?: string;
  }> {
    const resp = await this.requestJson("GET", `/images/tasks/${encodeURIComponent(taskId)}`);
    const status = String(resp?.status ?? "unknown").toLowerCase();
    const data = Array.isArray(resp?.data) ? resp.data : [];
    return { status, data, fail_reason: resp?.fail_reason ? String(resp.fail_reason) : undefined };
  }

  async submitLyrics(params: { prompt: string }): Promise<{ id: string }> {
    const resp = await this.requestJson("POST", "/suno/generate/lyrics/", {
      json: { prompt: params.prompt },
    });
    return { id: String(resp?.id ?? resp?.task_id ?? "") };
  }

  async pollLyrics(taskId: string): Promise<{
    status: string;
    text?: string;
    error?: string;
  }> {
    const resp = await this.requestJson("GET", `/suno/lyrics/${encodeURIComponent(taskId)}`);
    const status = String(resp?.status ?? "unknown").toLowerCase();
    return {
      status,
      text: typeof resp?.text === "string" ? resp.text : undefined,
      error: resp?.error ? String(resp.error) : undefined,
    };
  }

  async submitMidjourneyImagine(params: {
    prompt: string;
    base64_images?: string[];
    account?: string;
    action?: string;
  }): Promise<{ taskId: string; id?: string }> {
    const body: Record<string, unknown> = { prompt: params.prompt };
    if (params.account) body.account = params.account;
    if (params.base64_images?.length) body.base64Array = params.base64_images;
    const resp = await this.requestJson("POST", "/mj/submit/imagine", { json: body });
    return { taskId: String(resp?.taskId ?? resp?.task_id ?? resp?.id ?? "") };
  }

  async submitMidjourneyAction(params: {
    taskId: string;
    customId: string;
    account?: string;
  }): Promise<{ taskId: string; id?: string }> {
    const body: Record<string, unknown> = {
      taskId: params.taskId,
      customId: params.customId,
    };
    if (params.account) body.account = params.account;
    const resp = await this.requestJson("POST", "/mj/submit/action", { json: body });
    return { taskId: String(resp?.taskId ?? resp?.task_id ?? resp?.id ?? "") };
  }

  async pollMidjourney(taskId: string): Promise<{
    status: string;
    progress?: string;
    imageUrl?: string;
    buttons?: Array<{ customId: string; label: string }>;
    failReason?: string;
    raw: Record<string, unknown>;
  }> {
    const resp = await this.requestJson("GET", `/mj/task/${encodeURIComponent(taskId)}/fetch`);
    const status = String(resp?.status ?? "unknown").toLowerCase();
    const buttons = Array.isArray(resp?.buttons)
      ? resp.buttons.map((b: Record<string, unknown>) => ({
          customId: String(b?.customId ?? b?.custom_id ?? ""),
          label: String(b?.label ?? b?.text ?? ""),
        }))
      : [];
    return {
      status,
      progress: resp?.progress ? String(resp.progress) : undefined,
      imageUrl: resp?.imageUrl ?? resp?.image_url ? String(resp.imageUrl ?? resp?.image_url) : undefined,
      buttons,
      failReason: resp?.failReason ?? resp?.fail_reason
        ? String(resp.failReason ?? resp.fail_reason)
        : undefined,
      raw: resp ?? {},
    };
  }
}

let _client: T8starClient | null = null;

export function getClient(): T8starClient {
  if (_client === null) _client = new T8starClient(settingsFromEnv());
  return _client;
}
