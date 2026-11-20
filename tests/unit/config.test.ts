import { describe, expect, it } from "vitest";
import { codingPositions, QUESTION_COUNT, SUB_SCORES, ROUNDS } from "../../supabase/functions/_shared/config.ts";
import { bandFor, clampScore, compiledScore } from "../../supabase/functions/_shared/scoring.ts";

describe("coding question plan (D-07)", () => {
  it("HR and Managerial never have coding questions", () => {
    for (const n of [3, 6, 9]) { expect(codingPositions("hr", n)).toEqual([]); expect(codingPositions("mgr", n)).toEqual([]); }
  });
  it("Technical: 1 coding question for 3 and 6, 2 for 9; never position 1", () => {
    expect(codingPositions("tech", 3)).toEqual([3]);
    expect(codingPositions("tech", 6)).toEqual([4]);
    expect(codingPositions("tech", 9)).toEqual([4, 8]);
  });
  it("Coding round: two thirds coding, never the first question", () => {
    expect(codingPositions("code", 3)).toEqual([2, 3]);
    expect(codingPositions("code", 6)).toEqual([3, 4, 5, 6]);
    expect(codingPositions("code", 9)).toEqual([4, 5, 6, 7, 8, 9]);
  });
  it("positions are always within range and unique", () => {
    for (const r of ROUNDS) for (const n of Object.values(QUESTION_COUNT)) {
      const p = codingPositions(r, n);
      expect(new Set(p).size).toBe(p.length);
      for (const x of p) { expect(x).toBeGreaterThanOrEqual(2); expect(x).toBeLessThanOrEqual(n); }
    }
  });
  it("duration -> question count rule", () => { expect(QUESTION_COUNT).toEqual({ 5: 3, 10: 6, 15: 9 }); });
  it("sub-score names match the design", () => {
    expect(SUB_SCORES.hr).toEqual(["Communication", "Clarity", "Relevance", "Answer structure", "Fluency"]);
    expect(SUB_SCORES.code).toEqual(["Correctness", "Approach", "Code quality", "Explanation"]);
  });
});

describe("scoring", () => {
  it("bands follow the design (0-49 / 50-74 / 75-100)", () => {
    expect(bandFor(0)).toBe("Needs work"); expect(bandFor(49)).toBe("Needs work");
    expect(bandFor(50)).toBe("Getting there"); expect(bandFor(74)).toBe("Getting there");
    expect(bandFor(75)).toBe("Interview ready"); expect(bandFor(100)).toBe("Interview ready");
  });
  it("compiled score is the rounded mean of sub-scores", () => {
    expect(compiledScore({ a: 80, b: 74, c: 70, d: 62, e: 78 })).toBe(73);   // 364/5 = 72.8 -> 73
    expect(compiledScore({ a: 82, b: 70, c: 84, d: 76 })).toBe(78);          // 312/4
    expect(compiledScore({})).toBe(0);
  });
  it("clamps and sanitises model numbers", () => {
    expect(clampScore(150)).toBe(100); expect(clampScore(-3)).toBe(0); expect(clampScore("72.6")).toBe(73);
    expect(clampScore(NaN)).toBe(0); expect(clampScore(undefined)).toBe(0);
  });
  it("a model cannot push the compiled score above 100", () => {
    expect(compiledScore({ a: 9999, b: 9999 })).toBe(100);
  });
});
