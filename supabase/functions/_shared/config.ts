// Shared constants for the Edge Functions. Plain TypeScript: also imported by Vitest.
// Keep TERMS_VERSION identical to src/lib/legal.ts (a unit test enforces this).
export const TERMS_VERSION = "2026-11-20";

export const ROUNDS = ["hr", "tech", "code", "mgr"] as const;
export type Round = (typeof ROUNDS)[number];
export const LEVELS = ["Easy", "Medium", "Hard"] as const;
export type Level = (typeof LEVELS)[number];
export const DURATIONS = [5, 10, 15] as const;
export type Duration = (typeof DURATIONS)[number];

export const LANGUAGES = ["python", "java", "cpp", "c", "javascript"] as const;
export type Language = (typeof LANGUAGES)[number];

export const ROUND_NAMES: Record<Round, string> = {
  hr: "HR Round",
  tech: "Technical Round",
  code: "Coding Round",
  mgr: "Managerial Round",
};

export const ROUND_FOCUS: Record<Round, string> = {
  hr: "HR round: introduce yourself, strengths and weaknesses, goals, motivation, situational and behavioural questions.",
  tech: "Technical round: CS fundamentals (data structures, OOP, DBMS, operating systems, computer networks, basics of the student's language/projects).",
  code: "Coding round: problem solving with simple programs and short conceptual questions on complexity and approach.",
  mgr: "Managerial round: teamwork, conflict, deadlines, decisions with trade-offs, leadership and the student's projects.",
};

export const SUB_SCORES: Record<Round, string[]> = {
  hr: ["Communication", "Clarity", "Relevance", "Answer structure", "Fluency"],
  tech: ["Technical accuracy", "Depth", "Communication", "Clarity"],
  code: ["Correctness", "Approach", "Code quality", "Explanation"],
  mgr: ["Communication", "Relevance", "Answer structure", "Clarity"],
};

export const QUESTION_COUNT: Record<Duration, number> = { 5: 3, 10: 6, 15: 9 };

/** Which 1-based positions are coding questions (decision D-07). Coding never at position 1. */
export function codingPositions(round: Round, count: number): number[] {
  if (round === "hr" || round === "mgr") return [];
  if (round === "code") {
    const n = Math.ceil((count * 2) / 3);
    const out: number[] = [];
    for (let p = count; p >= 2 && out.length < n; p--) out.push(p);
    return out.sort((a, b) => a - b);
  }
  // technical
  if (count <= 3) return [count];
  if (count <= 6) return [4];
  return [4, 8];
}

export const DAILY_LIMIT = 3;
export const MAX_SOURCE_CHARS = 20000;
export const MAX_STDIN_CHARS = 10000;
export const CODE_RUNS_PER_MINUTE = 12;

export const LEVEL_HINT: Record<Level, string> = {
  Easy: "common questions, friendly follow-ups, suitable for a first attempt",
  Medium: "typical campus-interview level with some follow-ups",
  Hard: "deeper follow-ups and trickier questions, like product-company rounds",
};
