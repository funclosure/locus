import { describe, expect, it } from "vitest";
import {
  communityInputSchema,
  companyInputSchema,
  confidenceSchema,
  fitScoreSchema,
  sessionStartInputSchema,
} from "../../src/domain/validators.js";

describe("range validators", () => {
  it("accepts null or values from 0.0 through 1.0", () => {
    expect(confidenceSchema.parse(null)).toBeNull();
    expect(confidenceSchema.parse(0)).toBe(0);
    expect(confidenceSchema.parse(0.5)).toBe(0.5);
    expect(confidenceSchema.parse(1)).toBe(1);
    expect(fitScoreSchema.parse(null)).toBeNull();
  });

  it("rejects values outside 0.0 through 1.0", () => {
    expect(() => confidenceSchema.parse(-0.01)).toThrow();
    expect(() => confidenceSchema.parse(1.01)).toThrow();
    expect(() => fitScoreSchema.parse(2)).toThrow();
  });
});

describe("sessionStartInputSchema", () => {
  it("normalizes a minimal session start input", () => {
    expect(sessionStartInputSchema.parse({ goal: "Research AI-native notes companies" })).toEqual({
      profileId: 1,
      title: null,
      goal: "Research AI-native notes companies",
    });
  });
});

describe("companyInputSchema", () => {
  it("defaults company status to researching", () => {
    expect(companyInputSchema.parse({ name: "Things" }).status).toBe("researching");
  });
});

describe("communityInputSchema", () => {
  it("defaults status and nullable fields", () => {
    const parsed = communityInputSchema.parse({ name: "raycast/extensions" });
    expect(parsed.status).toBe("researching");
    expect(parsed.url).toBeNull();
    expect(parsed.ecosystem).toBeNull();
    expect(parsed.medianMergeDays).toBeNull();
    expect(parsed.outsiderMergeRatio).toBeNull();
    expect(parsed.fitScore).toBeNull();
  });

  it("coerces numeric strings from CLI flags", () => {
    const parsed = communityInputSchema.parse({
      name: "GRDB.swift",
      medianMergeDays: "1.2",
      outsiderMergeRatio: "0.41",
      fitScore: "0.75",
    });
    expect(parsed.medianMergeDays).toBe(1.2);
    expect(parsed.outsiderMergeRatio).toBe(0.41);
    expect(parsed.fitScore).toBe(0.75);
  });

  it("rejects an out-of-range outsider ratio", () => {
    expect(() => communityInputSchema.parse({ name: "x", outsiderMergeRatio: 1.5 })).toThrow();
  });

  it("rejects a negative median merge time", () => {
    expect(() => communityInputSchema.parse({ name: "x", medianMergeDays: -1 })).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() => communityInputSchema.parse({ name: "x", status: "shortlisted" })).toThrow();
  });

  it("accepts contributing as a status", () => {
    expect(communityInputSchema.parse({ name: "x", status: "contributing" }).status).toBe("contributing");
  });
});
