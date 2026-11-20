import { z } from "zod";
import { aiConfig, authenticate } from "../_shared/auth.ts";
import type { Level, Round } from "../_shared/config.ts";
import { evaluateInterview } from "../_shared/evaluate.ts";
import { sha256Hex } from "../_shared/hash.ts";
import { ApiError, CORS, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import type { EvalQuestion } from "../_shared/prompts.ts";

const Body = z.object({ interview_id: z.uuid() });

Deno.serve(async (req) => {
  const cors = CORS(req.headers.get("origin"), Deno.env.get("ALLOWED_ORIGINS"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: { code: "METHOD", message: "POST only" } }, 405, cors);
  let admin: Awaited<ReturnType<typeof authenticate>>["admin"] | null = null;
  let interviewId: string | null = null;
  try {
    const ctx = await authenticate(req);
    admin = ctx.admin;
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Missing interview.");
    interviewId = parsed.data.interview_id;

    const { data: iv } = await ctx.admin.from("interviews").select("*").eq("id", interviewId).eq("user_id", ctx.userId).maybeSingle();
    if (!iv) throw new ApiError(404, "NOT_FOUND", "Interview not found.");
    if (iv.status === "completed") return jsonResponse({ status: "completed" }, 200, cors);
    if (iv.status !== "processing") throw new ApiError(409, "NOT_READY", "This interview is not ready for feedback.");

    const [{ data: qs }, { data: profile }] = await Promise.all([
      ctx.admin.from("interview_questions").select("id,position,kind,question_text,transcript,code_language,code_source,last_run").eq("interview_id", interviewId).eq("status", "answered").order("position"),
      ctx.admin.from("profiles").select("branch,year_of_study").eq("id", ctx.userId).single(),
    ]);
    if (!qs || qs.length === 0) throw new ApiError(409, "NO_ANSWERS", "Feedback needs at least one answer.");

    const evalQs: EvalQuestion[] = [];
    for (const q of qs) {
      let code: EvalQuestion["code"] = null;
      if (q.kind === "coding" && q.code_source && q.code_language) {
        const run = (q.last_run as { run?: { passed: number; total: number; hash: string } } | null)?.run;
        const same = run && run.hash === await sha256Hex(q.code_language + "\n" + q.code_source);   // tests count only if they ran THIS code
        code = { language: q.code_language, source: q.code_source, tests: same ? { passed: run!.passed, total: run!.total } : null };
      }
      evalQs.push({ id: q.id, position: q.position, kind: q.kind, text: q.question_text, transcript: q.transcript, code });
    }

    const result = await evaluateInterview({
      ai: aiConfig(), round: iv.round as Round, level: iv.level as Level,
      student: { branch: profile?.branch ?? "CSE", year: profile?.year_of_study ?? "4th year" }, questions: evalQs, endedEarly: iv.ended_early,
    });

    for (const r of result.questions) {
      const { error } = await ctx.admin.from("interview_questions").update({ score: r.score, went_well: r.went_well, to_improve: r.to_improve, stronger_answer: r.stronger_answer }).eq("id", r.id).eq("user_id", ctx.userId);
      if (error) throw error;
    }
    const { data: done, error: uErr } = await ctx.admin.from("interviews").update({
      status: "completed", score: result.score, sub_scores: result.subScores, strengths: result.strengths, weaknesses: result.weaknesses, tips: result.tips,
      evaluated_at: new Date().toISOString(), error_message: null,
    }).eq("id", interviewId).eq("status", "processing").select("id");
    if (uErr) throw uErr;
    return jsonResponse({ status: "completed", score: result.score, updated: done?.length ?? 0 }, 200, cors);
  } catch (e) {
    if (admin && interviewId && !(e instanceof ApiError)) {
      await admin.from("interviews").update({ error_message: String((e as Error)?.message ?? "evaluation failed").slice(0, 300) }).eq("id", interviewId).eq("status", "processing");
    }
    return errorResponse(e, cors);
  }
});
