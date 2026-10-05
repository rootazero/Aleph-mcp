// Video generation (POST /v1/videos) and status polling (GET /v1/videos/{id}).
import { getClient, type T8starClient } from "./client.js";

export interface VideoGenParams {
  model: string;
  prompt: string;
  seconds?: string | number;
  size?: string;
  private?: boolean;
  seed?: string | number;
  image?: string; // URL, local path, or data URI — used for image-to-video
}

export type VideoStatus = "queued" | "in_progress" | "completed" | "failed" | "unknown";

export interface VideoPollResult {
  status: VideoStatus;
  progress?: number;
  video_url?: string;
  fail_reason?: string;
  seed?: string | number;
  raw: Record<string, unknown>;
}

export function parseVideoPollResponse(resp: any): VideoPollResult {
  const status = String(resp?.status ?? "unknown").toLowerCase() as VideoStatus;
  const valid: VideoStatus[] = ["queued", "in_progress", "completed", "failed"];
  const normalized: VideoStatus = valid.includes(status) ? status : "unknown";
  return {
    status: normalized,
    progress: typeof resp?.progress === "number" ? resp.progress : undefined,
    video_url: resp?.video_url ? String(resp.video_url) : undefined,
    fail_reason: resp?.fail_reason ? String(resp.fail_reason) : undefined,
    seed: resp?.seed,
    raw: resp ?? {},
  };
}

export function buildVideoPayload(p: VideoGenParams): {
  model: string;
  prompt: string;
  seconds?: string;
  size?: string;
  private?: string;
  seed?: string;
} {
  const payload: {
    model: string;
    prompt: string;
    seconds?: string;
    size?: string;
    private?: string;
    seed?: string;
  } = { model: p.model, prompt: p.prompt };
  if (p.seconds !== undefined && p.seconds !== null && p.seconds !== "")
    payload.seconds = String(p.seconds);
  if (p.size) payload.size = p.size;
  if (p.private !== undefined) payload.private = String(p.private);
  if (p.seed !== undefined && p.seed !== null && p.seed !== "") payload.seed = String(p.seed);
  return payload;
}

export function isTerminalStatus(status: VideoStatus): boolean {
  return status === "completed" || status === "failed";
}

export async function generateVideo(args: {
  model: string;
  prompt: string;
  seconds?: string;
  size?: string;
  private?: boolean;
  seed?: string;
  image?: string;
}): Promise<string> {
  const client = getClient();
  const payload = buildVideoPayload({
    model: args.model,
    prompt: args.prompt,
    seconds: args.seconds,
    size: args.size,
    private: args.private,
    seed: args.seed,
    image: args.image,
  });
  let images: Array<{ bytes: Buffer; filename: string }> | undefined;
  if (args.image) {
    const loaded = await client.loadImageBytes(args.image);
    images = [loaded];
  }
  const { id } = await client.submitVideo(
    {
      model: payload.model,
      prompt: payload.prompt,
      seconds: payload.seconds,
      size: payload.size,
      private: args.private,
      seed: payload.seed,
    },
    images,
  );
  if (!id) throw new Error("t8star video submission returned no task id");
  return await pollVideoUntilDone(client, id, args.model, true);
}

export async function getVideoStatus(args: { task_id: string }): Promise<string> {
  const client = getClient();
  return await pollVideoUntilDone(client, args.task_id, undefined, false);
}

async function pollVideoUntilDone(
  client: T8starClient,
  taskId: string,
  modelForHeader: string | undefined,
  downloadOnComplete: boolean,
): Promise<string> {
  const intervalMs = client.settings.videoPollIntervalMs;
  const timeoutMs = client.settings.videoPollTimeoutMs;
  const startedAt = Date.now();
  let lastProgress: number | undefined;
  for (;;) {
    const result = parseVideoPollResponse(await client.pollVideo(taskId));
    if (result.progress !== undefined && result.progress !== lastProgress) {
      lastProgress = result.progress;
    }
    if (result.status === "completed") {
      const url = result.video_url;
      if (!url) return formatResult(taskId, result, modelForHeader, "(no video_url in response)");
      if (downloadOnComplete && client.settings.videoDir) {
        const local = await client.downloadVideo(url, client.settings.videoDir, "video");
        return formatResult(taskId, result, modelForHeader, local);
      }
      return formatResult(taskId, result, modelForHeader, url);
    }
    if (result.status === "failed") {
      return formatResult(taskId, result, modelForHeader, undefined, result.fail_reason);
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `video task ${taskId} did not finish within ${timeoutMs}ms (last status: ${result.status}, progress: ${result.progress ?? "?"})`,
      );
    }
    await sleep(intervalMs);
  }
}

function formatResult(
  taskId: string,
  result: VideoPollResult,
  modelForHeader: string | undefined,
  location: string | undefined,
  failureReason?: string,
): string {
  const header = modelForHeader ? `Video task ${taskId} (${modelForHeader})` : `Video task ${taskId}`;
  const lines = [`${header}: ${result.status}`];
  if (result.progress !== undefined) lines.push(`  progress: ${result.progress}%`);
  if (failureReason) lines.push(`  fail_reason: ${failureReason}`);
  if (location) lines.push(`  ${location}`);
  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}