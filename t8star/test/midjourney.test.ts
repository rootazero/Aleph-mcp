import { describe, expect, it } from "vitest";
import { isMjTerminal, parseMjPollResponse } from "../src/midjourney.js";

describe("parseMjPollResponse", () => {
  it("normalizes status and exposes imageUrl + buttons", () => {
    const r = parseMjPollResponse({
      status: "SUCCESS",
      imageUrl: "https://cdn.mj/grid.png",
      buttons: [
        { customId: "MJ::JOB::upsample::1", label: "U1" },
        { customId: "MJ::JOB::variation::2", label: "V2" },
      ],
    });
    expect(r.status).toBe("success");
    expect(r.imageUrl).toBe("https://cdn.mj/grid.png");
    expect(r.buttons).toEqual([
      { customId: "MJ::JOB::upsample::1", label: "U1" },
      { customId: "MJ::JOB::variation::2", label: "V2" },
    ]);
  });
  it("tolerates snake_case aliases (custom_id, image_url, fail_reason)", () => {
    const r = parseMjPollResponse({
      status: "FAILURE",
      image_url: "https://cdn.mj/grid.png",
      fail_reason: "blocked",
      buttons: [{ custom_id: "MJ::JOB::x", text: "Reroll" }],
    });
    expect(r.imageUrl).toBe("https://cdn.mj/grid.png");
    expect(r.failReason).toBe("blocked");
    expect(r.buttons[0]).toEqual({ customId: "MJ::JOB::x", label: "Reroll" });
  });
  it("missing status becomes 'unknown'", () => {
    expect(parseMjPollResponse({}).status).toBe("unknown");
    expect(parseMjPollResponse({}).buttons).toEqual([]);
  });
});

describe("isMjTerminal", () => {
  it("success/completed/failure/failed/error are terminal", () => {
    expect(isMjTerminal("success")).toBe(true);
    expect(isMjTerminal("completed")).toBe(true);
    expect(isMjTerminal("failure")).toBe(true);
    expect(isMjTerminal("failed")).toBe(true);
    expect(isMjTerminal("error")).toBe(true);
  });
  it("in-progress states are not", () => {
    expect(isMjTerminal("submitted")).toBe(false);
    expect(isMjTerminal("processing")).toBe(false);
    expect(isMjTerminal("unknown")).toBe(false);
  });
});