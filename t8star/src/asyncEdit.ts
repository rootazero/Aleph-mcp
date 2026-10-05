// Async image edit (POST /v1/images/edits?async=true + GET /v1/images/tasks/{id}).
import { getClient, type T8starClient } from "./client.js";
import { type ImageItem, parseImageResponse } from "./images.js";

export interface AsyncEditParams {
  prompt: string;
  image: string;
  model?: string;
  size?: string;
  n?: number;
  mask?: string;
}

export interface AsyncEditPollResult {
  status: string;
  data: Array<{ url?: string; b64_json?: string }>;
  fail_reason?: string;
}

export function parseAsyncEditPollResponse(resp: any): AsyncEditPollResult {
  const status = String(resp?.status ?? "unknown").toLowerCase();
  const data = Array.isArray(resp?.data) ? resp.data : [];
  return {
    status,
    data,
    fail_reason: resp?.fail_reason ? String(resp.fail_reason) : undefined,
  };
}

export function isAsyncEditTerminal(status: string): boolean {
  return status === "completed" || status === "succeeded" || status === "failed";
}

export async function generateEditAsync(args: {
  prompt: string;
  image: string;
  model?: string;
  size?: string;
  n?: number;
  mask?: string;
}): Promise<string> {
  const client = getClient();
  const { id } = await client.submitAsyncEdit({
    prompt: args.prompt,
    image: args.image,
    model: args.model,
    size: args.size,
    n: args.n,
    mask: args.mask,
  });
  if (!id) throw new Error("t8star async edit submission returned no task id");
  return await pollAsyncEditUntilDone(client, id, args.model ?? "gpt-image-2", true);
}

export async function getEditStatus(args: { task_id: string }): Promise<string> {
  const client = getClient();
  return await pollAsyncEditUntilDone(client, args.task_id, undefined, false);
}

async function pollAsyncEditUntilDone(
  client: T8starClient,
  taskId: string,
  modelForHeader: string | undefined,
  downloadOnComplete: boolean,
): Promise<string> {
  const intervalMs = client.settings.videoPollIntervalMs;
  const timeoutMs = client.settings.videoPollTimeoutMs;
  const startedAt = Date.now();
  for (;;) {
    const result = parseAsyncEditPollResponse(await client.pollEdit(taskId));
    if (result.status === "completed" || result.status === "succeeded") {
      const items: ImageItem[] = parseImageResponse({ data: result.data });
      const header = `Edit task ${taskId}${modelForHeader ? ` (${modelForHeader})` : ""}: completed (${items.length} image(s))`;
      if (!downloadOnComplete || !client.settings.imageDir) {
        return header;
      }
      const lines = [header];
      let i = 0;
      for (const [kind, value] of items) {
        i += 1;
        if (kind === "url") {
          const local = await client.download(value, client.settings.imageDir, "edit");
          lines.push(`  ${i}. ${local}`);
        } else {
          const local = client.saveBinary(
            Buffer.from(value, "base64"),
            client.settings.imageDir,
            ".png",
            "edit",
          );
          lines.push(`  ${i}. ${local}`);
        }
      }
      return lines.join("\n");
    }
    if (result.status === "failed") {
      return `Edit task ${taskId}: failed${result.fail_reason ? ` (${result.fail_reason})` : ""}`;
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `edit task ${taskId} did not finish within ${timeoutMs}ms (last status: ${result.status})`,
      );
    }
    await sleep(intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}