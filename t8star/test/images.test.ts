import { describe, expect, it } from "vitest";
import { buildImagePayload, parseImageResponse } from "../src/images.js";

describe("buildImagePayload", () => {
  it("minimal", () => {
    expect(buildImagePayload({ prompt: "a cat", model: "gpt-image-2", size: "1024x1024" })).toEqual({
      model: "gpt-image-2",
      prompt: "a cat",
      n: 1,
      size: "1024x1024",
    });
  });
  it("includes optionals only when set", () => {
    const p = buildImagePayload({
      prompt: "x",
      model: "dall-e-3",
      size: "1024x1024",
      n: 2,
      quality: "high",
      responseFormat: "b64_json",
    });
    expect(p.n).toBe(2);
    expect(p.quality).toBe("high");
    expect(p.response_format).toBe("b64_json");
  });
  it("omits size when falsy", () => {
    expect("size" in buildImagePayload({ prompt: "x", model: "gpt-image-2", size: null })).toBe(false);
  });
});

describe("parseImageResponse", () => {
  it("handles url and b64 entries", () => {
    const data = { data: [{ url: "https://x/a.png" }, { b64_json: "QUFB" }] };
    expect(parseImageResponse(data)).toEqual([
      ["url", "https://x/a.png"],
      ["b64", "QUFB"],
    ]);
  });
  it("empty", () => {
    expect(parseImageResponse({})).toEqual([]);
  });
});
