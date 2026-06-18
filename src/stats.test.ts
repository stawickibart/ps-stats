import { describe, expect, it } from "vitest";
import { STAT_DEFINITIONS, csvEscape } from "./stats";

describe("stat definitions", () => {
  it("includes left and right directional pass/dribble stats", () => {
    expect(STAT_DEFINITIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "Lft", label: "Pass/Dribble Left", valueType: "integer" }),
        expect.objectContaining({ code: "Rgt", label: "Pass/Dribble Right", valueType: "integer" }),
      ]),
    );
  });

  it("keeps stat abbreviations unique", () => {
    const codes = STAT_DEFINITIONS.map((definition) => definition.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("CSV helpers", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(csvEscape('left, "right"\nside')).toBe('"left, ""right""\nside"');
  });
});
