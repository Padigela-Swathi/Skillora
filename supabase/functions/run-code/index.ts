import { z } from "zod";
import { authenticate } from "../_shared/auth.ts";
import { CODE_RUNS_PER_MINUTE, LANGUAGES, MAX_SOURCE_CHARS } from "../_shared/config.ts";
import { sha256Hex } from "../_shared/hash.ts";
import { ApiError, CORS, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { defaultRunner, RunnerError, runTests, type TestCase } from "../_shared/runner.ts";

const Body = z.object({
  question_id: z.uuid(), language: z.enum(LANGUAGES), mode: z.enum(["compile", "run"]),
  source: z.string().min(1).max(MAX_SOURCE_CHARS),
});

Deno.serve(async (req) => {
  const cors = CORS(req.headers.get("origin"), Deno.env.get("ALLOWED_ORIGINS"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: { code: "METHOD", message: "POST only" } }, 405, cors);
  try {
    const { userId, admin } = await authenticate(req);
    const parsed = Body.safeParse(await readJson(req, 80_000));
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Write some code first (max 20,000 characters).");
    const { question_id, language, mode, source } = parsed.data;

    const { data: q } = await admin.from("interview_questions").select("id,interview_id,kind,last_run").eq("id", question_id).eq("user_id", userId).maybeSingle();
    if (!q) throw new ApiError(404, "NOT_FOUND", "Question not found.");
    if (q.kind !== "coding") throw new ApiError(400, "NOT_CODING", "This question has no code editor.");
    const { data: iv } = await admin.from("interviews").select("status,started_at,duration_min").eq("id", q.interview_id).single();
    if (!iv || iv.status !== "in_progress") throw new ApiError(409, "INTERVIEW_NOT_ACTIVE", "This interview is not active.");

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from("code_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if ((count ?? 0) >= CODE_RUNS_PER_MINUTE) throw new ApiError(429, "RATE_LIMITED", "Too many runs. Wait a few seconds and try again.");

    const { data: run } = await admin.from("code_runs").insert({ user_id: userId, interview_id: q.interview_id, question_id, language, mode }).select("id").single();
    const runner = defaultRunner({ JUDGE0_URL: Deno.env.get("JUDGE0_URL") ?? undefined, JUDGE0_AUTH_TOKEN: Deno.env.get("JUDGE0_AUTH_TOKEN") ?? undefined });
    const started = Date.now();
    const at = new Date().toISOString();
    const hash = await sha256Hex(language + "\n" + source);
    const prev = (q.last_run ?? {}) as Record<string, unknown>;

    try {
      if (mode === "compile") {
        const c = await runner.compile({ language, source });
        await admin.from("code_runs").update({ compile_ok: c.ok, provider: c.provider, duration_ms: Date.now() - started }).eq("id", run!.id);
        await admin.from("interview_questions").update({ last_run: { ...prev, compile: { ok: c.ok, at, hash } } }).eq("id", question_id);
        return jsonResponse({ mode, ok: c.ok, output: c.output, provider: c.provider }, 200, cors);
      }

      const { data: priv } = await admin.from("question_private").select("tests").eq("question_id", question_id).single();
      const tests = (priv?.tests ?? []) as TestCase[];
      if (tests.length === 0) throw new ApiError(409, "NO_TESTS", "This question has no tests to run against.");
      const { outcomes, provider } = await runTests(runner, language, source, tests);
      const passed = outcomes.filter((o) => o.passed).length;
      const compileErr = outcomes.every((o) => o.status === "compile_error") ? (outcomes[0].error ?? "Compilation failed") : null;
      await admin.from("code_runs").update({ compile_ok: compileErr === null, passed, total: tests.length, provider, duration_ms: Date.now() - started }).eq("id", run!.id);
      await admin.from("interview_questions").update({ last_run: { ...prev, run: { passed, total: tests.length, at, hash, language } } }).eq("id", question_id);
      return jsonResponse({ mode, passed, total: tests.length, compile_error: compileErr, tests: outcomes, provider }, 200, cors);
    } catch (e) {
      if (e instanceof RunnerError) throw new ApiError(503, "RUNNER_UNAVAILABLE", "The code runner is busy right now. Please try again in a moment.");
      throw e;
    }
  } catch (e) { return errorResponse(e, cors); }
});
