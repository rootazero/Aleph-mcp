import { describe, expect, it } from "vitest";
import { isLyricsTerminal, parseLyricsPollResponse } from "../src/lyrics.js";

describe("parseLyricsPollResponse", () => {
  it("extracts text from completed response", () => {
    const r = parseLyricsPollResponse({
      status: "complete",
      text: "Verse 1\nLine 2\nLine 3",
    });
    expect(r.status).toBe("complete");
    expect(r.text).toBe("Verse 1\nLine 2\nLine 3");
  });
  it("captures error on failure", () => {
    const r = parseLyricsPollResponse({ status: "failed", error: "rate limit" });
    expect(r.status).toBe("failed");
    expect(r.error).toBe("rate limit");
  });
  it("missing status becomes 'unknown'", () => {
    expect(parseLyricsPollResponse({}).status).toBe("unknown");
  });
});

describe("isLyricsTerminal", () => {
  it("complete/completed/failed/error are terminal", () => {
    expect(isLyricsTerminal("complete")).toBe(true);
    expect(isLyricsTerminal("completed")).toBe(true);
    expect(isLyricsTerminal("failed")).toBe(true);
    expect(isLyricsTerminal("error")).toBe(true);
  });
  it("streaming/queued/processing are not", () => {
    expect(isLyricsTerminal("streaming")).toBe(false);
    expect(isLyricsTerminal("queued")).toBe(false);
  });
});