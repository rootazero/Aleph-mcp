import { describe, it, expect } from "vitest";
import { imageSizeFor, videoSizeFor } from "../src/ratios";

describe("imageSizeFor", () => {
  it("maps known ratios", () => {
    expect(imageSizeFor("1:1")).toBe("1024x1024");
    expect(imageSizeFor("16:9")).toBe("1024x576");
    expect(imageSizeFor("9:16")).toBe("576x1024");
  });
  it("throws on unknown ratio", () => {
    expect(() => imageSizeFor("21:9")).toThrow(/aspect_ratio/);
  });
});

describe("videoSizeFor", () => {
  it("maps known ratios", () => {
    expect(videoSizeFor("16:9")).toBe("1280x720");
    expect(videoSizeFor("9:16")).toBe("720x1280");
    expect(videoSizeFor("1:1")).toBe("960x960");
  });
  it("throws on unknown ratio", () => {
    expect(() => videoSizeFor("4:3")).toThrow(/aspect_ratio/);
  });
});
