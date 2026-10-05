import { describe, expect, it } from "vitest";
import {
  isAsyncEditTerminal,
  parseAsyncEditPollResponse,
} from "../src/asyncEdit.js";

describe("parseAsyncEditPollResponse", () => {
  it("normalizes status to lowercase", () => {
    const r = parseAsyncEditPollResponse({ status: "COMPLETED", data: [] });
    expect(r.status).toBe("completed");
    expect(r.data).toEqual([]);
  });
  it("captures url and b64 entries", () => {
    const r = parseAsyncEditPollResponse({
      status: "completed",
      data: [{ url: "https://cdn.example/a.png" }, { b64_json: "QUFB" }],
    });
    expect(r.data).toHaveLength(2);
    expect(r.data[0].url).toBe("https://cdn.example/a.png");
    expect(r.data[1].b64_json).toBe("QUFB");
  });
  it("captures fail_reason on failure", () => {
    const r = parseAsyncEditPollResponse({ status: "failed", fail_reason: "nsfw" });
    expect(r.fail_reason).toBe("nsfw");
  });
  it("missing status becomes 'unknown'", () => {
    expect(parseAsyncEditPollResponse({}).status).toBe("unknown");
  });
});

describe("isAsyncEditTerminal", () => {
  it("completed/succeeded/failed are terminal", () => {
    expect(isAsyncEditTerminal("completed")).toBe(true);
    expect(isAsyncEditTerminal("succeeded")).toBe(true);
    expect(isAsyncEditTerminal("failed")).toBe(true);
  });
  it("queued/running/processing are not", () => {
    expect(isAsyncEditTerminal("queued")).toBe(false);
    expect(isAsyncEditTerminal("running")).toBe(false);
  });
});