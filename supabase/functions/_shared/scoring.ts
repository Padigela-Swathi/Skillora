export type Band = "Needs work" | "Getting there" | "Interview ready";

export function bandFor(score: number): Band {
  return score >= 75 ? "Interview ready" : score >= 50 ? "Getting there" : "Needs work";
}

export function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Compiled score = rounded mean of the sub-scores (product rule; no confidence score). */
export function compiledScore(subScores: Record<string, number>): number {
  const vals = Object.values(subScores).map(clampScore);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
