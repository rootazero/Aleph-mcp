import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Settings,
  SiliconFlowError,
  buildFilename,
  extractApiError,
  extFromUrl,
  looksRemote,
  toImageField,
} from "../src/client";

const ENV_KEYS = [
  "SILICONFLOW_API_KEY",
  "SILICONFLOW_API_BASE",
  "SILICONFLOW_IMAGE_DIR",
  "SILICONFLOW_AUDIO_DIR",
];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("Settings.fromEnv", () => {
  it("uses defaults and trims the api key", () => {
    process.env.SILICONFLOW_API_KEY = "  sk-abc ";
    const s = Settings.fromEnv();
    expect(s.apiKey).toBe("sk-abc");
    expect(s.apiBase).toBe("https://api.siliconflow.cn/v1");
    expect(s.imageDir).toBeUndefined();
    expect(s.audioDir).toBeUndefined();
  });

  it("falls back audio dir to image dir and strips trailing slash from base", () => {
    process.env.SILICONFLOW_API_KEY = "k";
    process.env.SILICONFLOW_IMAGE_DIR = "/tmp/imgs";
    process.env.SILICONFLOW_API_BASE = "https://api.siliconflow.com/v1/";
    const s = Settings.fromEnv();
    expect(s.audioDir).toBe("/tmp/imgs");
    expect(s.apiBase).toBe("https://api.siliconflow.com/v1");
  });
});

describe("extractApiError", () => {
  it("pulls message from JSON body", () => {
    expect(extractApiError(400, '{"message": "invalid model"}')).toBe(
      "SiliconFlow API error 400: invalid model",
    );
  });
  it("falls back to plain text", () => {
    expect(extractApiError(500, "boom")).toBe("SiliconFlow API error 500: boom");
  });
});

describe("extFromUrl", () => {
  it("derives extension from url path", () => {
    expect(extFromUrl("https://x/y/a.mp4?sig=1")).toBe(".mp4");
    expect(extFromUrl("https://x/y/a.jpeg")).toBe(".jpeg");
    expect(extFromUrl("https://x/y/blob")).toBe(".png");
  });
});

describe("buildFilename", () => {
  it("builds deterministic names", () => {
    expect(buildFilename("image", ".png", 1700)).toBe("image_1700.png");
    expect(buildFilename("speech", "mp3", 42)).toBe("speech_42.mp3");
  });
});

describe("looksRemote", () => {
  it("detects http and data uris", () => {
    expect(looksRemote("https://x/a.png")).toBe(true);
    expect(looksRemote("data:image/png;base64,AAA")).toBe(true);
    expect(looksRemote("/home/u/a.png")).toBe(false);
  });
});

describe("toImageField", () => {
  it("passes through urls", () => {
    expect(toImageField("https://x/a.png")).toBe("https://x/a.png");
  });
  it("throws on missing file", () => {
    expect(() => toImageField("/no/such/file.png")).toThrow(SiliconFlowError);
  });
  it("base64-encodes a local file as a data uri", () => {
    const dir = mkdtempSync(join(tmpdir(), "sf-"));
    const f = join(dir, "pic.png");
    writeFileSync(f, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const out = toImageField(f);
    expect(out.startsWith("data:image/png;base64,")).toBe(true);
    expect(Buffer.from(out.split(",", 2)[1], "base64")).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });
});
