// Midjourney image generation via /mj/submit/imagine, /mj/submit/action, /mj/task/{id}/fetch.
// Midjourney returns 4 images per imagine; user picks U1-U4 (upscale one) or V1-V4 (variation of one)
// via button customIds that come back in the poll response.
import { tmpdir } from "node:os";
import { getClient, type T8starClient } from "./client.js";

export interface MjButton {
  customId: string;
  label: string;
}

export interface MjPollResult {
  status: string;
  progress?: string;
  imageUrl?: string;
  buttons: MjButton[];
  failReason?: string;
  raw: Record<string, unknown>;
}

export function parseMjPollResponse(resp: any): MjPollResult {
  const status = String(resp?.status ?? "unknown").toLowerCase();
  const buttons: MjButton[] = Array.isArray(resp?.buttons)
    ? resp.buttons.map((b: Record<string, unknown>) => ({
        customId: String(b?.customId ?? b?.custom_id ?? ""),
        label: String(b?.label ?? b?.text ?? ""),
      }))
    : [];
  const imageUrl = resp?.imageUrl ?? resp?.image_url;
  return {
    status,
    progress: resp?.progress ? String(resp.progress) : undefined,
    imageUrl: imageUrl ? String(imageUrl) : undefined,
    buttons,
    failReason: resp?.failReason
      ? String(resp.failReason)
      : resp?.fail_reason
        ? String(resp.fail_reason)
        : undefined,
    raw: resp ?? {},
  };
}

export function isMjTerminal(status: string): boolean {
  const s = status.toLowerCase();
  return s === "success" || s === "completed" || s === "failure" || s === "failed" || s === "error";
}

export async function imagineMj(args: {
  prompt: string;
  image_urls?: string[];
  account?: string;
}): Promise<string> {
  const client = getClient();
  const base64Images: string[] = [];
  if (args.image_urls?.length) {
    for (const v of args.image_urls) {
      const { bytes } = await client.loadImageBytes(v);
      base64Images.push(bytes.toString("base64"));
    }
  }
  const { taskId } = await client.submitMidjourneyImagine({
    prompt: args.prompt,
    base64_images: base64Images.length ? base64Images : undefined,
    account: args.account,
  });
  if (!taskId) throw new Error("t8star midjourney submission returned no task id");
  return await pollMjUntilDone(client, taskId, true);
}

export async function mjAction(args: {
  task_id: string;
  custom_id: string;
  account?: string;
}): Promise<string> {
  const client = getClient();
  const { taskId } = await client.submitMidjourneyAction({
    taskId: args.task_id,
    customId: args.custom_id,
    account: args.account,
  });
  if (!taskId) throw new Error("t8star midjourney action returned no task id");
  return await pollMjUntilDone(client, taskId, true);
}

export async function getMjStatus(args: { task_id: string }): Promise<string> {
  const client = getClient();
  return await pollMjUntilDone(client, args.task_id, false);
}

async function pollMjUntilDone(
  client: T8starClient,
  taskId: string,
  downloadOnComplete: boolean,
): Promise<string> {
  const intervalMs = client.settings.videoPollIntervalMs;
  const timeoutMs = client.settings.videoPollTimeoutMs;
  const startedAt = Date.now();
  for (;;) {
    const result = parseMjPollResponse(await client.pollMidjourney(taskId));
    if (result.status === "success" || result.status === "completed") {
      return await formatMjResult(taskId, result, downloadOnComplete ? client : undefined);
    }
    if (
      result.status === "failure" ||
      result.status === "failed" ||
      result.status === "error"
    ) {
      return await formatMjResult(taskId, result, undefined, result.failReason);
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `mj task ${taskId} did not finish within ${timeoutMs}ms (last status: ${result.status})`,
      );
    }
    await sleep(intervalMs);
  }
}

async function formatMjResult(
  taskId: string,
  result: MjPollResult,
  client: T8starClient | undefined,
  failureReason?: string,
): Promise<string> {
  const lines = [`Midjourney task ${taskId}: ${result.status}`];
  if (failureReason) {
    lines.push(`  fail_reason: ${failureReason}`);
    return lines.join("\n");
  }
  if (result.imageUrl) {
    if (client) {
      const local = await saveMjImage(client, result.imageUrl, client.settings.imageDir);
      lines.push(`  image: ${local}  (source: ${result.imageUrl})`);
    } else {
      lines.push(`  image: ${result.imageUrl}`);
    }
  }
  if (result.buttons.length) {
    lines.push(`  buttons:`);
    for (const b of result.buttons) {
      lines.push(`    ${b.label} -> ${b.customId}`);
    }
  }
  return lines.join("\n");
}

async function saveMjImage(
  client: T8starClient,
  url: string,
  saveDir: string | undefined,
): Promise<string> {
  const target = saveDir ?? tmpdir();
  // client.download() gracefully falls back to the remote URL when the binary fetch fails,
  // so we don't need a separate download-with-retry wrapper for Midjourney.
  return await client.download(url, target, "mj");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}