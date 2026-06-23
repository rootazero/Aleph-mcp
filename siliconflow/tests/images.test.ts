import { describe, it, expect } from "vitest";
import { buildImagePayload, parseImageResponse, imageTools } from "../src/images";

describe("buildImagePayload", () => {
  it("includes only set optional fields", () => {
    const p = buildImagePayload({ prompt: "a cat", model: "M", imageSize: "1024x1024" });
    expect(p).toEqual({
      model: "M",
      prompt: "a cat",
      batch_size: 1,
      num_inference_steps: 20,
      image_size: "1024x1024",
    });
  });

  it("adds negative_prompt, seed, guidance_scale, cfg, and image fields when present", () => {
    const p = buildImagePayload({
      prompt: "a dog",
      model: "M",
      negativePrompt: "blurry",
      seed: 7,
      guidanceScale: 3.5,
      cfg: 1.2,
      images: { image: "data:...", image2: "" },
    });
    expect(p.negative_prompt).toBe("blurry");
    expect(p.seed).toBe(7);
    expect(p.guidance_scale).toBe(3.5);
    expect(p.cfg).toBe(1.2);
    expect(p.image).toBe("data:...");
    expect("image2" in p).toBe(false); // falsy image value is skipped
  });
});

describe("parseImageResponse", () => {
  it("extracts urls and seed", () => {
    const [urls, seed] = parseImageResponse({
      images: [{ url: "https://x/a.png" }, { nope: 1 }, { url: "https://x/b.png" }],
      seed: 99,
    });
    expect(urls).toEqual(["https://x/a.png", "https://x/b.png"]);
    expect(seed).toBe(99);
  });
});

describe("imageTools", () => {
  it("registers generate_image and edit_image", () => {
    expect(imageTools.map((t) => t.name).sort()).toEqual(["edit_image", "generate_image"]);
  });
});
