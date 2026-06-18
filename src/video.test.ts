import { describe, expect, it } from "vitest";
import { DEFAULT_VIDEO_SYNC, deriveMatchTime, parseClockToSeconds, parseYouTubeVideoId } from "./video";

describe("video helpers", () => {
  it("extracts YouTube IDs from common URL formats", () => {
    expect(parseYouTubeVideoId("youtube.com/watch?v=2pcXGp8v4-s&feature=youtu.be")).toBe("2pcXGp8v4-s");
    expect(parseYouTubeVideoId("https://youtu.be/2pcXGp8v4-s")).toBe("2pcXGp8v4-s");
    expect(parseYouTubeVideoId("https://www.youtube.com/embed/2pcXGp8v4-s")).toBe("2pcXGp8v4-s");
  });

  it("parses clock strings into seconds", () => {
    expect(parseClockToSeconds("12:34")).toBe(754);
    expect(parseClockToSeconds("1:02:03")).toBe(3723);
    expect(parseClockToSeconds("bad")).toBeUndefined();
  });

  it("maps video seconds to the second half after the anchor", () => {
    const sync = {
      ...DEFAULT_VIDEO_SYNC,
      firstHalfStartVideoSeconds: 10,
      firstHalfEndVideoSeconds: 1210,
      secondHalfStartVideoSeconds: 1400,
      secondHalfStartMatchClock: "20:00",
    };

    const time = deriveMatchTime(sync, 1430);

    expect(time.half).toBe("second");
    expect(time.minute).toBe("20:30");
    expect(time.bucket).toBe("20 - 25");
  });
});
