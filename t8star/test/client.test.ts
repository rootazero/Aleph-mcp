import { afterEach, describe, expect, it } from "vitest";
import {
  buildFilename,
  extForFormat,
  extFromUrl,
  extractApiError,
  settingsFromEnv,
  T8starClient,
  T8starError,
} from "../src/client.js";

const ENV_KEYS = ["T8STAR_API_KEY", "T8STAR_API_BASE", "T8STAR_IMAGE_DIR", "T8STAR_AUDIO_DIR"];
afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("settingsFromEnv", () => {
  it("uses defaults and trims the key", () => {
    process.env.T8STAR_API_KEY = "  sk-abc ";
    const s = settingsFromEnv();
    expect(s.apiKey).toBe("sk-abc");
    expect(s.apiBase).toBe("https://ai.t8star.org/v1");
    expect(s.imageDir).toBeUndefined();
    expect(s.audioDir).toBeUndefined();
  });

  it("falls back audioDir to imageDir and strips trailing slash from base", () => {
    process.env.T8STAR_API_KEY = "k";
    process.env.T8STAR_IMAGE_DIR = "/tmp/imgs";
    process.env.T8STAR_API_BASE = "https://ai.t8star.cn/v1/";
    const s = settingsFromEnv();
    expect(s.audioDir).toBe("/tmp/imgs");
    expect(s.apiBase).toBe("https://ai.t8star.cn/v1");
  });
});

describe("extractApiError", () => {
  it("reads nested error.message", () => {
    const body = '{"error":{"message":"Invalid URL","type":"invalid_request_error"}}';
    expect(extractApiError(404, body)).toBe("T8star API error 404: Invalid URL");
  });
  it("falls back to raw text", () => {
    expect(extractApiError(500, "boom")).toBe("T8star API error 500: boom");
  });
});

describe("pure helpers", () => {
  it("extFromUrl", () => {
    expect(extFromUrl("https://x/y/a.mp4?sig=1")).toBe(".mp4");
    expect(extFromUrl("https://x/y/a.jpeg")).toBe(".jpeg");
    expect(extFromUrl("https://x/y/blob")).toBe(".png");
  });
  it("buildFilename", () => {
    expect(buildFilename("image", ".png", 1700)).toBe("image_1700.png");
    expect(buildFilename("speech", "mp3", 42)).toBe("speech_42.mp3");
  });
  it("extForFormat", () => {
    expect(extForFormat("opus")).toBe("opus");
    expect(extForFormat("weird")).toBe("mp3");
  });
});

describe("T8starClient", () => {
  it("throws without an api key", () => {
    expect(() => new T8starClient({ apiKey: "", apiBase: "https://ai.t8star.org/v1" })).toThrow(
      T8starError,
    );
  });
});
