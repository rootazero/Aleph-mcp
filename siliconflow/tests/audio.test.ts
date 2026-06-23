import { describe, it, expect } from "vitest";
import { buildSpeechPayload, extForFormat, audioTools } from "../src/audio";

describe("buildSpeechPayload", () => {
  it("builds a non-streaming payload and omits voice when unset", () => {
    expect(buildSpeechPayload({ input: "hi", model: "M" })).toEqual({
      model: "M",
      input: "hi",
      response_format: "mp3",
      speed: 1.0,
      gain: 0.0,
      stream: false,
    });
  });
  it("includes voice when set", () => {
    const p = buildSpeechPayload({ input: "hi", model: "M", voice: "M:alex" });
    expect(p.voice).toBe("M:alex");
  });
});

describe("extForFormat", () => {
  it("passes known formats through and falls back to mp3", () => {
    expect(extForFormat("wav")).toBe("wav");
    expect(extForFormat("opus")).toBe("opus");
    expect(extForFormat("flac")).toBe("mp3");
  });
});

describe("audioTools", () => {
  it("registers generate_speech", () => {
    expect(audioTools.map((t) => t.name)).toEqual(["generate_speech"]);
  });
});
