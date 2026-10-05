// Music generation via /suno/generate and /suno/feed.
import { getClient, type T8starClient } from "./client.js";

export interface MusicGenParams {
  prompt: string;
  tags?: string;
  mv?: string;
  title?: string;
  seed?: string | number;
}

export function buildMusicPayload(p: MusicGenParams): Record<string, unknown> {
  const payload: Record<string, unknown> = { prompt: p.prompt };
  if (p.tags) payload.tags = p.tags;
  if (p.mv) payload.mv = p.mv;
  if (p.title) payload.title = p.title;
  if (p.seed !== undefined && p.seed !== null && p.seed !== "") payload.seed = String(p.seed);
  return payload;
}

export interface MusicClip {
  id: string;
  status: string;
  audio_url?: string;
  title?: string;
  tags?: string;
  image_large_url?: string;
  raw: Record<string, unknown>;
}

export function parseMusicFeedResponse(resp: Array<Record<string, unknown>>): MusicClip[] {
  const clips: MusicClip[] = [];
  for (const entry of resp) {
    const id = String(entry?.id ?? entry?.clip_id ?? "");
    if (!id) continue;
    const status = String(entry?.status ?? "unknown").toLowerCase();
    clips.push({
      id,
      status,
      audio_url: entry?.audio_url ? String(entry.audio_url) : undefined,
      title: entry?.title ? String(entry.title) : undefined,
      tags: entry?.tags ? String(entry.tags) : undefined,
      image_large_url: entry?.image_large_url ? String(entry.image_large_url) : undefined,
      raw: entry,
    });
  }
  return clips;
}

export function isMusicTerminal(status: string): boolean {
  const s = status.toLowerCase();
  return s === "complete" || s === "completed" || s === "failed" || s === "error";
}

export async function generateMusic(args: {
  prompt: string;
  tags?: string;
  mv?: string;
  title?: string;
  seed?: string;
}): Promise<string> {
  const client = getClient();
  const payload = buildMusicPayload({
    prompt: args.prompt,
    tags: args.tags,
    mv: args.mv,
    title: args.title,
    seed: args.seed,
  });
  const { id, clips: initialClips } = await client.submitMusic({
    prompt: payload.prompt as string,
    tags: payload.tags as string | undefined,
    mv: payload.mv as string | undefined,
    title: payload.title as string | undefined,
    seed: payload.seed as string | number | undefined,
  });
  if (!id || !initialClips.length) {
    throw new Error("t8star music submission returned no clips");
  }
  const intervalMs = client.settings.videoPollIntervalMs;
  const timeoutMs = client.settings.videoPollTimeoutMs;
  const startedAt = Date.now();
  const clipIds = initialClips.map((c) => c.id);
  let feed: MusicClip[] = [];
  for (;;) {
    feed = parseMusicFeedResponse(await client.pollMusicFeed(clipIds));
    const allDone = feed.length > 0 && feed.every((c) => isMusicTerminal(c.status));
    if (allDone) break;
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `music task ${id} did not finish within ${timeoutMs}ms (last statuses: ${feed.map((c) => c.status).join(", ") || "no feed"})`,
      );
    }
    await sleep(intervalMs);
  }
  return renderMusicResult(client, id, feed);
}

function renderMusicResult(client: T8starClient, taskId: string, clips: MusicClip[]): string {
  const lines = [`Music task ${taskId}: ${clips.length} clip(s)`];
  let i = 0;
  for (const clip of clips) {
    i += 1;
    const header = `  ${i}. [${clip.status}] ${clip.title ?? clip.id}`;
    if (clip.status === "failed" || clip.status === "error") {
      lines.push(header);
      continue;
    }
    if (!clip.audio_url) {
      lines.push(`${header} (no audio_url)`);
      continue;
    }
    if (client.settings.musicDir) {
      const local = client.download(clip.audio_url, client.settings.musicDir, "music");
      lines.push(`${header} ${local}`);
    } else {
      lines.push(`${header} ${clip.audio_url}  (set T8STAR_MUSIC_DIR to keep it)`);
    }
  }
  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}