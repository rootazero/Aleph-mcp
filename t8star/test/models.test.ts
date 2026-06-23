import { describe, expect, it } from "vitest";
import { computeBalance, filterModels } from "../src/models.js";

const SAMPLE = {
  data: [
    { id: "gpt-image-2", owned_by: "custom", supported_endpoint_types: ["openai"] },
    { id: "claude-opus-4-5", owned_by: "vertex-ai", supported_endpoint_types: ["anthropic", "openai"] },
    { id: "tts-1", owned_by: "openai", supported_endpoint_types: ["openai"] },
    { id: "blank" },
    { owned_by: "x" },
  ],
};

describe("filterModels", () => {
  it("no filter returns ids", () => {
    expect(filterModels(SAMPLE)).toEqual(["gpt-image-2", "claude-opus-4-5", "tts-1", "blank"]);
  });
  it("by query (case-insensitive substring)", () => {
    expect(filterModels(SAMPLE, { query: "IMAGE" })).toEqual(["gpt-image-2"]);
  });
  it("by owned_by", () => {
    expect(filterModels(SAMPLE, { ownedBy: "vertex-ai" })).toEqual(["claude-opus-4-5"]);
  });
  it("by endpoint type", () => {
    expect(filterModels(SAMPLE, { endpointType: "anthropic" })).toEqual(["claude-opus-4-5"]);
  });
});

describe("computeBalance", () => {
  it("uncapped sentinel", () => {
    const b = computeBalance({ hard_limit_usd: 1e8 }, { total_usage: 12930.31 });
    expect(b.unlimited).toBe(true);
    expect(b.usedUsd).toBe(129.3031);
    expect(b.remainingUsd).toBeNull();
  });
  it("finite limit", () => {
    const b = computeBalance({ hard_limit_usd: 50.0 }, { total_usage: 1000.0 });
    expect(b.unlimited).toBe(false);
    expect(b.usedUsd).toBe(10.0);
    expect(b.remainingUsd).toBe(40.0);
  });
});
