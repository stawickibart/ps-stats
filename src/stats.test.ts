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

  it("includes applicable DataMB-inspired power soccer stat defaults", () => {
    expect(STAT_DEFINITIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ProgP", label: "Progressive Pass" }),
        expect.objectContaining({ code: "ProgC", label: "Progressive Carry" }),
        expect.objectContaining({ code: "KP", label: "Key Pass" }),
        expect.objectContaining({ code: "Int", label: "Interception" }),
        expect.objectContaining({ code: "Blk", label: "Shot Block" }),
        expect.objectContaining({ code: "2o1F", label: "2-on-1 Forced" }),
        expect.objectContaining({ code: "GAP", label: "Goal Area Positioning Offense" }),
      ]),
    );
  });

  it("excludes soccer-only defaults that do not apply to power soccer", () => {
    const labels = STAT_DEFINITIONS.map((definition) => definition.label.toLowerCase()).join(" ");
    expect(labels).not.toContain("aerial");
    expect(labels).not.toContain("offside");
    expect(labels).not.toContain("headed");
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
