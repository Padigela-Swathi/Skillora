// Interview generation: spoken questions + verified coding problems. Pure orchestration; I/O is injected.
import { codingPositions, type Level, type Round } from "./config.ts";
import { chatJson, type AiConfig } from "./nvidia.ts";
import { codingPrompt, spokenPrompt, type StudentCtx } from "./prompts.ts";
import { normalizeOutput, type Runner, type TestCase } from "./runner.ts";
import { STARTERS } from "./starters.ts";


export interface CodingPublic {
  title: string; statement: string; input_format: string; output_format: string; constraints?: string;
  examples: { input: string; output: string }[];
  starters: typeof STARTERS;
}
export interface GeneratedQuestion {
  position: number; kind: "spoken" | "coding"; text: string; topic: string | null;
  coding: CodingPublic | null; tests: TestCase[] | null;
}

const THEMES = ["strings", "arrays and counting", "numbers and math", "hashing / frequency", "sorting and searching", "two pointers", "simple dynamic programming"];

/** Run the AI's reference solution on each test input; the program's real output becomes the expected output. */
export async function verifyTests(runner: Runner, referenceSource: string, inputs: string[]): Promise<TestCase[]> {
  const unique = [...new Set(inputs.map((i) => i.replace(/\r\n/g, "\n")))].filter((i) => i.trim().length > 0);
  const results: (TestCase | null)[] = new Array(unique.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < unique.length) {
      const i = next++;
      try {
        const r = await runner.run({ language: "python", source: referenceSource, stdin: unique[i].endsWith("\n") ? unique[i] : unique[i] + "\n", timeLimitSec: 3 });
        const out = normalizeOutput(r.stdout);
        if (r.status === "ok" && out.length > 0 && out.length < 1000) results[i] = { input: unique[i], expected: out, visible: false };
      } catch { /* unusable test: dropped */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, unique.length) }, worker));
  const ok = results.filter((t): t is TestCase => t !== null);
  return ok.map((t, idx) => ({ ...t, visible: idx < 2 }));
}

async function buildCoding(ai: AiConfig, runner: Runner, round: Round, level: Level, student: StudentCtx, idx: number): Promise<{ text: string; topic: string; coding: CodingPublic; tests: TestCase[] } | { fallbackText: string; topic: string }> {
  const p = codingPrompt({ round, level, student, avoid: [`Theme to use: ${THEMES[idx % THEMES.length]}`] });
  const spec = await chatJson(ai, { system: p.system, user: p.user, schema: p.schema, maxTokens: 2500, temperature: 0.7 });
  const fallbackText = `Explain how you would solve this problem and what its time complexity would be. ${spec.statement}`.slice(0, 1900);
  let tests: TestCase[] = [];
  try { tests = await verifyTests(runner, spec.reference_solution_python, spec.test_inputs); } catch { tests = []; }
  if (tests.length < 3) return { fallbackText, topic: spec.title };
  const coding: CodingPublic = {
    title: spec.title, statement: spec.statement, input_format: spec.input_format, output_format: spec.output_format,
    ...(spec.constraints ? { constraints: spec.constraints } : {}),
    examples: tests.filter((t) => t.visible).map((t) => ({ input: t.input, output: t.expected })),
    starters: STARTERS,
  };
  return { text: `${spec.title}. ${spec.statement}`.slice(0, 1900), topic: spec.title, coding, tests };
}

export async function generateInterview(a: { ai: AiConfig; runner: Runner; round: Round; level: Level; count: number; student: StudentCtx }): Promise<GeneratedQuestion[]> {
  const codePos = codingPositions(a.round, a.count);
  const spokenPos = Array.from({ length: a.count }, (_, i) => i + 1).filter((p) => !codePos.includes(p));

  const spokenPromise = (async () => {
    if (spokenPos.length === 0) return [] as { text: string; topic?: string }[];
    const p = spokenPrompt({ round: a.round, level: a.level, count: spokenPos.length, student: a.student });
    const first = (await chatJson(a.ai, { system: p.system, user: p.user, schema: p.schema, maxTokens: 2500, temperature: 0.8 })).questions;
    const seen = new Set<string>();
    const uniq = first.filter((q) => { const k = q.text.toLowerCase().replace(/\W+/g, " ").trim(); if (seen.has(k)) return false; seen.add(k); return true; });
    if (uniq.length >= spokenPos.length) return uniq.slice(0, spokenPos.length);
    const more = spokenPrompt({ round: a.round, level: a.level, count: spokenPos.length - uniq.length, student: a.student, avoid: uniq.map((q) => q.text) });
    const extra = (await chatJson(a.ai, { system: more.system, user: more.user, schema: more.schema, maxTokens: 2000, temperature: 0.8 })).questions;
    const all = [...uniq, ...extra];
    if (all.length < spokenPos.length) throw Object.assign(new Error("AI returned too few questions"), { code: "AI_BAD_OUTPUT" });
    return all.slice(0, spokenPos.length);
  })();

  const codingPromises = codePos.map((_, i) => buildCoding(a.ai, a.runner, a.round, a.level, a.student, i));
  const [spoken, coding] = await Promise.all([spokenPromise, Promise.all(codingPromises)]);

  const out: GeneratedQuestion[] = [];
  spokenPos.forEach((position, i) => out.push({ position, kind: "spoken", text: spoken[i].text, topic: spoken[i].topic ?? null, coding: null, tests: null }));
  codePos.forEach((position, i) => {
    const c = coding[i];
    if ("coding" in c) out.push({ position, kind: "coding", text: c.text, topic: c.topic, coding: c.coding, tests: c.tests });
    else out.push({ position, kind: "spoken", text: c.fallbackText, topic: c.topic, coding: null, tests: null });
  });
  return out.sort((x, y) => x.position - y.position);
}
