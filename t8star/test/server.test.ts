import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

describe("server", () => {
  it("registers all five tools", async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const { tools } = await client.listTools();
    const names = new Set(tools.map((t) => t.name));
    expect(names).toEqual(
      new Set(["generate_image", "edit_image", "generate_speech", "list_models", "get_balance"]),
    );
    await client.close();
  });
});
