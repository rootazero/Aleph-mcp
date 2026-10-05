// Suno lyrics generation (POST /suno/generate/lyrics + GET /suno/lyrics/{id}).
import { getClient, type T8starClient } from "./client.js";

export interface LyricsPollResult {
  status: string;
  text?: string;
  error?: string;
}

export function parseLyricsPollResponse(resp: any): LyricsPollResult {
  const status = String(resp?.status ?? "unknown").toLowerCase();
  return {
    status,
    text: typeof resp?.text === "string" ? resp.text : undefined,
    error: resp?.error ? String(resp.error) : undefined,
  };
}

export function isLyricsTerminal(status: string): boolean {
  const s = status.toLowerCase();
  return s === "complete" || s === "completed" || s === "failed" || s === "error";
}

export async function generateLyrics(args: { prompt: string }): Promise<string> {
  const client = getClient();
  const { id } = await client.submitLyrics({ prompt: args.prompt });
  if (!id) throw new Error("t8star lyrics submission returned no task id");
  return await pollLyricsUntilDone(client, id);
}

async function pollLyricsUntilDone(client: T8starClient, taskId: string): Promise<string> {
  const intervalMs = client.settings.videoPollIntervalMs;
  const timeoutMs = client.settings.videoPollTimeoutMs;
  const startedAt = Date.now();
  let last: LyricsPollResult | undefined;
  for (;;) {
    last = parseLyricsPollResponse(await client.pollLyrics(taskId));
    if (isLyricsTerminal(last.status)) break;
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `lyrics task ${taskId} did not finish within ${timeoutMs}ms (last status: ${last.status})`,
      );
    }
    await sleep(intervalMs);
  }
  if (last?.status === "failed" || last?.status === "error") {
    return `Lyrics task ${taskId}: ${last.status}${last.error ? ` (${last.error})` : ""}`;
  }
  const text = last?.text ?? "";
  return `Lyrics task ${taskId}: ${last?.status ?? "unknown"}\n${text}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}