import { describe, it, expect } from "vitest";
import {
  buildVideoPayload,
  parseSubmitResponse,
  parseStatusResponse,
  videoTools,
} from "../src/videos";
import { SiliconFlowError } from "../src/client";

describe("buildVideoPayload", () => {
  it("includes only set optional fields", () => {
    expect(buildVideoPayload({ prompt: "p", model: "M", imageSize: "1280x720" })).toEqual({
      model: "M",
      prompt: "p",
      image_size: "1280x720",
    });
  });
  it("adds image, negative_prompt, seed when present", () => {
    const p = buildVideoPayload({
      prompt: "p",
      model: "M",
      imageSize: "1280x720",
      image: "data:...",
      negativePrompt: "no",
      seed: 5,
    });
    expect(p.image).toBe("data:...");
    expect(p.negative_prompt).toBe("no");
    expect(p.seed).toBe(5);
  });
});

describe("parseSubmitResponse", () => {
  it("returns requestId", () => {
    expect(parseSubmitResponse({ requestId: "abc" })).toBe("abc");
  });
  it("throws when requestId missing", () => {
    expect(() => parseSubmitResponse({})).toThrow(SiliconFlowError);
  });
});

describe("parseStatusResponse", () => {
  it("normalizes status, reason, and urls", () => {
    expect(
      parseStatusResponse({
        status: "Succeed",
        results: { videos: [{ url: "https://x/v.mp4" }, { nope: 1 }] },
      }),
    ).toEqual({ status: "Succeed", reason: undefined, urls: ["https://x/v.mp4"] });
  });
  it("defaults status to Unknown", () => {
    expect(parseStatusResponse({})).toEqual({ status: "Unknown", reason: undefined, urls: [] });
  });
});

describe("videoTools", () => {
  it("registers the three video tools", () => {
    expect(videoTools.map((t) => t.name).sort()).toEqual([
      "generate_video",
      "get_video_status",
      "submit_video_generation",
    ]);
  });
});
