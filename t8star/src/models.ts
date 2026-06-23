// Model discovery (GET /v1/models) and account balance (GET /v1/dashboard/billing/*).
import { getClient } from "./client.js";

const BALANCE_SENTINEL = 1e8; // t8star uses ~1e8 as an "uncapped" hard limit
const MODEL_DISPLAY_CAP = 100; // the catalog has 800+ models; cap the dump

export function filterModels(
  data: any,
  opts: { ownedBy?: string; endpointType?: string; query?: string } = {},
): string[] {
  const out: string[] = [];
  for (const m of data?.data ?? []) {
    const id = m?.id;
    if (!id) continue;
    if (opts.ownedBy && m.owned_by !== opts.ownedBy) continue;
    if (opts.endpointType && !(m.supported_endpoint_types ?? []).includes(opts.endpointType)) continue;
    if (opts.query && !String(id).toLowerCase().includes(opts.query.toLowerCase())) continue;
    out.push(id);
  }
  return out;
}

export interface Balance {
  usedUsd: number;
  limitUsd: unknown;
  remainingUsd: number | null;
  unlimited: boolean;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export function computeBalance(subscription: any, usage: any): Balance {
  const hardLimit = subscription?.hard_limit_usd;
  const usedUsd = round4(Number(usage?.total_usage ?? 0) / 100); // OpenAI: total_usage is in cents
  const unlimited = typeof hardLimit !== "number" || hardLimit >= BALANCE_SENTINEL;
  const remainingUsd = unlimited ? null : round4(hardLimit - usedUsd);
  return { usedUsd, limitUsd: hardLimit, remainingUsd, unlimited };
}

export async function listModels(
  args: { owned_by?: string; endpoint_type?: string; query?: string } = {},
): Promise<string> {
  const client = getClient();
  const data = await client.requestJson("GET", "/models");
  const models = filterModels(data, {
    ownedBy: args.owned_by,
    endpointType: args.endpoint_type,
    query: args.query,
  });
  if (models.length === 0) return "No models found.";
  const shown = models.slice(0, MODEL_DISPLAY_CAP);
  const body = shown.map((m) => `  - ${m}`).join("\n");
  const more =
    models.length <= MODEL_DISPLAY_CAP
      ? ""
      : `\n  ... and ${models.length - MODEL_DISPLAY_CAP} more (use query= to narrow)`;
  return `${models.length} model(s):\n${body}${more}`;
}

export async function getBalance(): Promise<string> {
  const client = getClient();
  const sub = await client.requestJson("GET", "/dashboard/billing/subscription");
  const usage = await client.requestJson("GET", "/dashboard/billing/usage");
  const bal = computeBalance(sub, usage);
  if (bal.unlimited) return `T8star account: used $${bal.usedUsd} (quota: uncapped)`;
  return `T8star account: used $${bal.usedUsd} / limit $${bal.limitUsd} -> remaining $${bal.remainingUsd}`;
}
