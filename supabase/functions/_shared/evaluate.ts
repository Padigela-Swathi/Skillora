import { SUB_SCORES, type Level, type Round } from "./config.ts";
import { chatJson, type AiConfig } from "./nvidia.ts";
import { evaluationPrompt, type EvalQuestion, type StudentCtx } from "./prompts.ts";
import { clampScore, compiledScore } from "./scoring.ts";

export interface EvaluationResult {
  questions: { id: string; score: number; went_well: string; to_improve: string; stronger_answer: string }[];
  subScores: Record<string, number>;
  score: number;
  strengths: string[]; weaknesses: string[]; tips: string[];
}

export async function evaluateInterview(a: { ai: AiConfig; round: Round; level: Level; student: StudentCtx; questions: EvalQuestion[]; endedEarly: boolean }): Promise<EvaluationResult> {
  const p = evaluationPrompt({ round: a.round, level: a.level, student: a.student, questions: a.questions, endedEarly: a.endedEarly });
  const raw = await chatJson(a.ai, { system: p.system, user: p.user, schema: p.schema, maxTokens: 4000, temperature: 0.3 });

  // canonical sub-score names, order and clamping are decided here, not by the model
  const lower = new Map(Object.entries(raw.sub_scores).map(([k, v]) => [k.toLowerCase(), v]));
  const subScores: Record<string, number> = {};
  for (const n of SUB_SCORES[a.round]) subScores[n] = clampScore(lower.get(n.toLowerCase()));

  const wanted = new Set(a.questions.map((q) => q.id));
  const questions = raw.questions.filter((q) => wanted.has(q.id)).map((q) => ({
    id: q.id, score: clampScore(q.score), went_well: q.went_well.trim(), to_improve: q.to_improve.trim(), stronger_answer: q.stronger_answer.trim(),
  }));
  return { questions, subScores, score: compiledScore(subScores), strengths: raw.strengths, weaknesses: raw.weaknesses, tips: raw.tips };
}
