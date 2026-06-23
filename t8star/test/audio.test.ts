import { describe, expect, it } from "vitest";
import { buildSpeechPayload } from "../src/audio.js";

describe("buildSpeechPayload", () => {
  it("defaults", () => {
    expect(buildSpeechPayload({ input: "hello", model: "tts-1", voice: "alloy" })).toEqual({
      model: "tts-1",
      input: "hello",
      voice: "alloy",
      response_format: "mp3",
      speed: 1.0,
    });
  });
  it("overrides", () => {
    const p = buildSpeechPayload({
      input: "x",
      model: "tts-1-hd",
      voice: "nova",
      responseFormat: "wav",
      speed: 1.5,
    });
    expect(p.model).toBe("tts-1-hd");
    expect(p.voice).toBe("nova");
    expect(p.response_format).toBe("wav");
    expect(p.speed).toBe(1.5);
  });
  it("omits empty voice", () => {
    expect("voice" in buildSpeechPayload({ input: "x", model: "tts-1", voice: null })).toBe(false);
  });
});
