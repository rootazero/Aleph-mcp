import { describe, expect, it } from "vitest";
import {
  buildVideoPayload,
  isTerminalStatus,
  parseVideoPollResponse,
} from "../src/videos.js";

describe("buildVideoPayload", () => {
  it("minimal T2V", () => {
    expect(buildVideoPayload({ model: "veo3", prompt: "a dog runs" })).toEqual({
      model: "veo3",
      prompt: "a dog runs",
    });
  });
  it("includes optionals only when set", () => {
    const p = buildVideoPayload({
      model: "wan-3.0-i2v",
      prompt: "a cat",
      seconds: 5,
      private: true,
      seed: 42,
      size: "1280x720",
    });
    expect(p.seconds).toBe("5");
    expect(p.private).toBe("true");
    expect(p.seed).toBe("42");
    expect(p.size).toBe("1280x720");
  });
  it("omits empty/undefined fields", () => {
    const p = buildVideoPayload({
      model: "sora_video2",
      prompt: "x",
      seconds: "",
      seed: null,
    });
    expect("seconds" in p).toBe(false);
    expect("seed" in p).toBe(false);
  });
});

describe("parseVideoPollResponse", () => {
  it("normalizes status and exposes progress/url/fail", () => {
    const r = parseVideoPollResponse({
      status: "IN_PROGRESS",
      progress: 42,
      video_url: "https://cdn.example/v.mp4",
      fail_reason: null,
    });
    expect(r.status).toBe("in_progress");
    expect(r.progress).toBe(42);
    expect(r.video_url).toBe("https://cdn.example/v.mp4");
  });
  it("unknown status falls back to 'unknown'", () => {
    const r = parseVideoPollResponse({ status: "weird_thing" });
    expect(r.status).toBe("unknown");
  });
  it("missing status becomes 'unknown'", () => {
    expect(parseVideoPollResponse({}).status).toBe("unknown");
  });
});

describe("isTerminalStatus", () => {
  it("completed and failed are terminal", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
  });
  it("queued/in_progress/unknown are not", () => {
    expect(isTerminalStatus("queued")).toBe(false);
    expect(isTerminalStatus("in_progress")).toBe(false);
    expect(isTerminalStatus("unknown")).toBe(false);
  });
});