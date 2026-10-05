import { describe, expect, it } from "vitest";
import { buildMusicPayload, isMusicTerminal, parseMusicFeedResponse } from "../src/music.js";

describe("buildMusicPayload", () => {
  it("minimal", () => {
    expect(buildMusicPayload({ prompt: "an upbeat pop track" })).toEqual({
      prompt: "an upbeat pop track",
    });
  });
  it("includes optionals only when set", () => {
    const p = buildMusicPayload({
      prompt: "lofi hip hop beats",
      tags: "lofi, chill",
      mv: "v5",
      title: "Late Night",
      seed: 123,
    });
    expect(p.tags).toBe("lofi, chill");
    expect(p.mv).toBe("v5");
    expect(p.title).toBe("Late Night");
    expect(p.seed).toBe("123");
  });
  it("omits empty seed", () => {
    const p = buildMusicPayload({ prompt: "x", seed: "" });
    expect("seed" in p).toBe(false);
  });
});

describe("parseMusicFeedResponse", () => {
  it("extracts id, status, audio_url, and metadata", () => {
    const feed = parseMusicFeedResponse([
      {
        id: "clip-1",
        status: "complete",
        audio_url: "https://cdn.example/a.mp3",
        title: "Track A",
        tags: "pop",
        image_large_url: "https://cdn.example/cover.jpg",
      },
      {
        id: "clip-2",
        status: "streaming",
        audio_url: "https://cdn.example/b.mp3",
      },
    ]);
    expect(feed).toHaveLength(2);
    expect(feed[0].status).toBe("complete");
    expect(feed[0].audio_url).toBe("https://cdn.example/a.mp3");
    expect(feed[0].title).toBe("Track A");
    expect(feed[1].status).toBe("streaming");
  });
  it("skips entries without id", () => {
    const feed = parseMusicFeedResponse([{ status: "complete" }, { id: "ok" }]);
    expect(feed).toHaveLength(1);
    expect(feed[0].id).toBe("ok");
  });
});

describe("isMusicTerminal", () => {
  it("complete and failed are terminal", () => {
    expect(isMusicTerminal("complete")).toBe(true);
    expect(isMusicTerminal("completed")).toBe(true);
    expect(isMusicTerminal("failed")).toBe(true);
    expect(isMusicTerminal("error")).toBe(true);
  });
  it("streaming and unknown are not", () => {
    expect(isMusicTerminal("streaming")).toBe(false);
    expect(isMusicTerminal("queued")).toBe(false);
    expect(isMusicTerminal("unknown")).toBe(false);
  });
});