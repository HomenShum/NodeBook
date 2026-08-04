import { canaryDecision, canaryPercent } from "./canary";

describe("canaryPercent", () => {
  it("is off for unset, garbage, zero, and negative values", () => {
    expect(canaryPercent(undefined)).toBe(0);
    expect(canaryPercent("")).toBe(0);
    expect(canaryPercent("not-a-number")).toBe(0);
    expect(canaryPercent("0")).toBe(0);
    expect(canaryPercent("-10")).toBe(0);
  });

  it("passes sane values through and caps at 50", () => {
    expect(canaryPercent("10")).toBe(10);
    expect(canaryPercent("50")).toBe(50);
    expect(canaryPercent("90")).toBe(50);
    expect(canaryPercent("Infinity")).toBe(0);
  });
});

describe("canaryDecision", () => {
  it("is stable when the split is off, even with a stale canary cookie", () => {
    expect(canaryDecision("1", 0)).toBe("stable");
    expect(canaryDecision(undefined, 0, () => 0)).toBe("stable");
  });

  it("is sticky on the cookie in both directions", () => {
    expect(canaryDecision("1", 10, () => 0.99)).toBe("canary");
    expect(canaryDecision("0", 10, () => 0)).toBe("stable");
  });

  it("assigns new visitors by the dice roll against the percent", () => {
    // random()*100 < percent → canary
    expect(canaryDecision(undefined, 10, () => 0.05)).toBe("canary"); // 5 < 10
    expect(canaryDecision(undefined, 10, () => 0.1)).toBe("stable"); // 10 !< 10
    expect(canaryDecision(undefined, 50, () => 0.499)).toBe("canary");
    expect(canaryDecision(undefined, 50, () => 0.5)).toBe("stable");
  });
});
