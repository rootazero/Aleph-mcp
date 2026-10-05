import { describe, expect, it } from "vitest";
import {
  buildFluxPayload,
  isFluxTerminal,
  parseFluxPollResponse,
} from "../src/flux.js";

describe("buildFluxPayload", () => {
  it("minimal", () => {
    expect(buildFluxPayload({ model: "flux-2-pro", prompt: "a cat" })).toEqual({
      prompt: "a cat",
    });
  });
  it("includes width/height when positive", () => {
    const p = buildFluxPayload({ model: "flux-2-max", prompt: "x", width: 1024, height: 768 });
    expect(p.width).toBe(1024);
    expect(p.height).toBe(768);
  });
  it("includes seed only when non-negative", () => {
    expect(buildFluxPayload({ model: "flux-2-flex", prompt: "x", seed: 0 }).seed).toBe(0);
    expect("seed" in buildFluxPayload({ model: "flux-2-flex", prompt: "x", seed: -1 })).toBe(false);
  });
});

describe("parseFluxPollResponse", () => {
  it("extracts sample URL and seed from result object", () => {
    const r = parseFluxPollResponse({
      status: "Ready",
      result: { sample: "https://cdn.example/img.png", seed: 7 },
    });
    expect(r.status).toBe("Ready");
    expect(r.image_url).toBe("https://cdn.example/img.png");
    expect(r.seed).toBe(7);
  });
  it("captures error details on failure", () => {
    const r = parseFluxPollResponse({ status: "Failed", details: "nsfw content" });
    expect(r.status).toBe("Failed");
    expect(r.error).toBe("nsfw content");
  });
});

describe("isFluxTerminal", () => {
  it("ready/failed/error are terminal", () => {
    expect(isFluxTerminal("Ready")).toBe(true);
    expect(isFluxTerminal("Failed")).toBe(true);
    expect(isFluxTerminal("Error")).toBe(true);
  });
  it("processing is not", () => {
    expect(isFluxTerminal("Processing")).toBe(false);
    expect(isFluxTerminal("Pending")).toBe(false);
  });
});