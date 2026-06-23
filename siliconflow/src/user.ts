/** Account + model-discovery tools (GET /v1/user/info, GET /v1/models). */

import { z } from "zod";
import type { ToolDef } from "./tool-def.js";
import { getClient } from "./client.js";

export function parseUserInfo(data: any): {
  name: any;
  email: any;
  total_balance: any;
  charge_balance: any;
  gift_balance: any;
} {
  const d = data.data ?? data;
  return {
    name: d.name,
    email: d.email,
    total_balance: d.totalBalance,
    charge_balance: d.chargeBalance,
    gift_balance: d.balance,
  };
}

export function parseModelList(data: any): string[] {
  return (data.data ?? []).filter((m: any) => m?.id).map((m: any) => m.id as string);
}

async function getUserInfo(_args: Record<string, any>) {
  const client = getClient();
  const data = await client.requestJson("GET", "/user/info");
  const info = parseUserInfo(data);
  const text =
    "SiliconFlow account:\n" +
    `  name: ${info.name}\n` +
    `  email: ${info.email}\n` +
    `  total balance: ${info.total_balance}\n` +
    `  charged: ${info.charge_balance}  gift: ${info.gift_balance}`;
  return { content: [{ type: "text" as const, text }] };
}

async function listModels(args: Record<string, any>) {
  const client = getClient();
  const params: Record<string, string> = {};
  if (args.type) params.type = args.type;
  if (args.sub_type) params.sub_type = args.sub_type;
  const data = await client.requestJson("GET", "/models", {
    params: Object.keys(params).length ? params : undefined,
  });
  const models = parseModelList(data);
  if (models.length === 0) {
    return { content: [{ type: "text" as const, text: "No models found." }] };
  }
  const text = "Available models:\n" + models.map((m) => `  - ${m}`).join("\n");
  return { content: [{ type: "text" as const, text }] };
}

export const userTools: ToolDef[] = [
  {
    name: "get_user_info",
    description: "Show the SiliconFlow account profile and balances (total / charged / gift).",
    inputSchema: {},
    handler: getUserInfo,
  },
  {
    name: "list_models",
    description:
      "List available models. type: text|image|audio|video; sub_type: e.g. text-to-image, image-to-image, text-to-video, speech-to-text.",
    inputSchema: {
      type: z.string().optional(),
      sub_type: z.string().optional(),
    },
    handler: listModels,
  },
];
