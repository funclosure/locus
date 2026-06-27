import { describe, expect, it } from "vitest";
import {
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
