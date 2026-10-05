import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

describe("server", () => {
  it("registers all sixteen tools", async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const { tools } = await client.listTools();
    const names = new Set(tools.map((t) => t.name));
    expect(names).toEqual(
      new Set([
        "generate_image",
        "edit_image",
        "generate_speech",
        "list_models",
        "get_balance",
        "generate_video",
        "get_video",
        "generate_music",
        "generate_flux",
        "get_flux",
        "edit_image_async",
        "get_edit",
        "generate_lyrics",
        "imagine_mj",
        "mj_action",
        "get_mj",
      ]),
    );
    await client.close();
  });
});
