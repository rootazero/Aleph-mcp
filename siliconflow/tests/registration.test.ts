import { describe, it, expect } from "vitest";
import { allTools } from "../src/index";

describe("allTools", () => {
  it("aggregates exactly the 8 expected tools with unique names", () => {
    const names = allTools.map((t) => t.name).sort();
    expect(names).toEqual([
      "edit_image",
      "generate_image",
      "generate_speech",
      "generate_video",
      "get_user_info",
      "get_video_status",
      "list_models",
      "submit_video_generation",
    ]);
    expect(new Set(names).size).toBe(8);
  });

  it("every tool has a non-empty description and an input schema object", () => {
    for (const t of allTools) {
      expect(t.description.length).toBeGreaterThan(0);
      expect(typeof t.inputSchema).toBe("object");
    }
  });
});
