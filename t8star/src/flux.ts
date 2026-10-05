// BFL Flux 2 async image generation (POST /bfl/v1/flux-2-{max,pro,flex}).
import { getClient, type T8starClient } from "./client.js";

export type FluxModel = "flux-2-max" | "flux-2-pro" | "flux-2-flex";

export interface FluxGenParams {
  model: FluxModel;
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  imagePrompt?: string;
}

export interface FluxPollResult {
  status: string;
  image_url?: string;
  seed?: number;
  error?: string;
  raw: Record<string, unknown>;
}

export function buildFluxPayload(p: FluxGenParams): Record<string, unknown> {
  const payload: Record<string, unknown> = { prompt: p.prompt };
  if (typeof p.width === "number" && p.width > 0) payload.width = p.width;
  if (typeof p.height === "number" && p.height > 0) payload.height = p.height;
  if (typeof p.seed === "number" && p.seed >= 0) payload.seed = p.seed;
  return payload;
}

export function parseFluxPollResponse(resp: any): FluxPollResult {
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

export function isFluxTerminal(status: string): boolean {
  const s = status.toLowerCase();
  return s === "ready" || s === "failed" || s === "error";
}

export async function generateFlux(args: {
  model: FluxModel;
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  image_prompt?: string;
}): Promise<string> {
  const client = getClient();
  const { id } = await client.submitFlux({
    model: args.model,
    prompt: args.prompt,
    width: args.width,
    height: args.height,
    seed: args.seed,
    imagePrompt: args.image_prompt,
  });
  if (!id) throw new Error("t8star flux submission returned no task id");
  return await pollFluxUntilDone(client, id, args.model, true);
}

export async function getFluxStatus(args: { task_id: string }): Promise<string> {
  const client = getClient();
  return await pollFluxUntilDone(client, args.task_id, undefined, false);
}

async function pollFluxUntilDone(
  client: T8starClient,
  taskId: string,
  modelForHeader: string | undefined,
  downloadOnComplete: boolean,
): Promise<string> {
  const intervalMs = client.settings.videoPollIntervalMs;
  const timeoutMs = client.settings.videoPollTimeoutMs;
  const startedAt = Date.now();
  for (;;) {
    const result = parseFluxPollResponse(await client.pollFlux(taskId));
    if (result.status.toLowerCase() === "ready") {
      const url = result.image_url;
      if (!url) return formatResult(taskId, result, modelForHeader, "(no image_url in response)");
      if (downloadOnComplete && client.settings.imageDir) {
        const local = await client.download(url, client.settings.imageDir, "flux");
        return formatResult(taskId, result, modelForHeader, local);
      }
      return formatResult(taskId, result, modelForHeader, url);
    }
    if (result.status.toLowerCase() === "failed" || result.status.toLowerCase() === "error") {
      return formatResult(taskId, result, modelForHeader, undefined, result.error);
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `flux task ${taskId} did not finish within ${timeoutMs}ms (last status: ${result.status})`,
      );
    }
    await sleep(intervalMs);
  }
}

function formatResult(
  taskId: string,
  result: FluxPollResult,
  modelForHeader: string | undefined,
  location: string | undefined,
  failureReason?: string,
): string {
  const header = modelForHeader ? `Flux task ${taskId} (${modelForHeader})` : `Flux task ${taskId}`;
  const lines = [`${header}: ${result.status}`];
  if (result.seed !== undefined) lines.push(`  seed: ${result.seed}`);
  if (failureReason) lines.push(`  error: ${failureReason}`);
  if (location) lines.push(`  ${location}`);
  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}