import { describe, expect, it } from "vitest";
import { mergeOptionsWithJson, parseTargetRef } from "../../src/cli/input.js";

describe("parseTargetRef", () => {
  it("parses compact target refs", () => {
    expect(parseTargetRef("company:42")).toEqual({ targetType: "company", targetId: 42 });
    expect(parseTargetRef("role:7")).toEqual({ targetType: "role", targetId: 7 });
  });

  it("rejects malformed target refs", () => {
    expect(() => parseTargetRef("company")).toThrow();
    expect(() => parseTargetRef("company:abc")).toThrow();
    expect(() => parseTargetRef("unknown:1")).toThrow();
  });
});

describe("mergeOptionsWithJson", () => {
  it("lets explicit CLI options override JSON payload fields", () => {
    expect(
      mergeOptionsWithJson(
        { name: "Linear", status: undefined },
        { name: "Craft", status: "watching", summary: "Design-forward tools." },
      ),
    ).toEqual({
      name: "Linear",
      status: "watching",
      summary: "Design-forward tools.",
    });
  });

  it("drops undefined option values", () => {
    expect(mergeOptionsWithJson({ title: undefined }, { title: "iOS Engineer" })).toEqual({
      title: "iOS Engineer",
    });
  });
});
