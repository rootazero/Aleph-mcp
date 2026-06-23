import { describe, it, expect } from "vitest";
import { renderAssets, SiliconFlowClient, Settings } from "../src/client";

function fakeClient(): SiliconFlowClient {
  return new SiliconFlowClient(new Settings("k", "https://api.siliconflow.cn/v1", undefined, undefined));
}

describe("renderAssets", () => {
  it("reports when no urls are returned", async () => {
    const out = await renderAssets(fakeClient(), "image", [], undefined, "image", "Header");
    expect(out).toBe("Header: no image returned by the API.");
  });

  it("lists remote urls with an expiry hint when no save dir", async () => {
    const out = await renderAssets(
      fakeClient(),
      "image",
      ["https://x/a.png", "https://x/b.png"],
      undefined,
      "image",
      "Generated 2 image(s)",
    );
    expect(out).toBe(
      "Generated 2 image(s):\n" +
        "  1. https://x/a.png  (remote URL, expires soon — set a save dir to keep it)\n" +
        "  2. https://x/b.png  (remote URL, expires soon — set a save dir to keep it)",
    );
  });
});
