// Diagnostic (live): how long does each model take for an evaluation-sized request?
import { describe, it } from "vitest";
import { chatJson } from "../../supabase/functions/_shared/nvidia.ts";
import { evaluationPrompt } from "../../supabase/functions/_shared/prompts.ts";

const live = process.env.LIVE_TESTS ? describe : describe.skip;
const q = (n: number, t: string) => ({ id: `q${n}`, position: n, kind: "spoken" as const, text: "Tell me about a challenge you solved.", transcript: t, code: null });

live("evaluation latency per model", () => {
  for (const model of ["google/gemma-4-31b-it", "poolside/laguna-xs-2.1", "nvidia/nemotron-3.5-bolt-e4b"]) {
    it(model, async () => {
      const p = evaluationPrompt({ round: "hr", level: "Easy", student: { branch: "IT", year: "3rd year" }, endedEarly: false,
        questions: [q(1, "I built an attendance app with React and Supabase for my class and fixed a crash before a demo by tracing a missing environment variable."), q(2, "My strength is staying calm while debugging; during a hackathon I fixed a broken demo ten minutes before judging.")] });
      const t = Date.now();
      let out = "ok";
      try { await chatJson({ apiKey: "proxy-injected", model, fallbackModel: model, deadlineMs: 140000 }, { system: p.system, user: p.user, schema: p.schema, maxTokens: 4000, temperature: 0.3 }); }
      catch (e) { out = (e as Error).message.slice(0, 80); }
      console.log(`LATENCY ${model}: ${((Date.now() - t) / 1000).toFixed(1)}s -> ${out}`);
    }, 170000);
  }
});
