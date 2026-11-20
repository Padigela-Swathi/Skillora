import { z } from "zod";
import { aiConfig, authenticate } from "../_shared/auth.ts";
import { DURATIONS, LEVELS, QUESTION_COUNT, ROUNDS, TERMS_VERSION } from "../_shared/config.ts";
import { ApiError, CORS, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { generateInterview } from "../_shared/interview_gen.ts";
import { AiError } from "../_shared/nvidia.ts";
import { defaultRunner } from "../_shared/runner.ts";

const Body = z.object({
  round: z.enum(ROUNDS), level: z.enum(LEVELS),
  duration: z.coerce.number().refine((d) => (DURATIONS as readonly number[]).includes(d), "invalid duration"),
});

Deno.serve(async (req) => {
  const cors = CORS(req.headers.get("origin"), Deno.env.get("ALLOWED_ORIGINS"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: { code: "METHOD", message: "POST only" } }, 405, cors);
  let interviewId: string | null = null;
  let admin: Awaited<ReturnType<typeof authenticate>>["admin"] | null = null;
  try {
    const ctx = await authenticate(req);
    admin = ctx.admin;
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Choose a round, level and duration.");
    const { round, level, duration } = parsed.data;

    const { data: profile } = await ctx.admin.from("profiles").select("full_name,college,branch,year_of_study,terms_version").eq("id", ctx.userId).single();
    if (!profile || profile.terms_version !== TERMS_VERSION) throw new ApiError(403, "TERMS_REQUIRED", "Please accept the Terms and Privacy Policy first.");
    if (!profile.full_name || !profile.college || !profile.branch || !profile.year_of_study) throw new ApiError(403, "PROFILE_INCOMPLETE", "Please complete your profile first.");

    const ai = aiConfig();
    if (!ai.apiKey) throw new AiError("AI_NOT_CONFIGURED", "NVIDIA_API_KEY missing");   // fail before using the daily allowance

    const count = QUESTION_COUNT[duration as 5 | 10 | 15];
    const { data: reserved, error: rErr } = await ctx.admin.rpc("reserve_interview", { p_user: ctx.userId, p_round: round, p_level: level, p_duration: duration, p_count: count });
    if (rErr) {
      if (rErr.message.includes("DAILY_LIMIT")) throw new ApiError(429, "DAILY_LIMIT", "You have used all 3 interviews for today. Come back tomorrow.");
      if (rErr.message.includes("GENERATION_IN_PROGRESS")) throw new ApiError(409, "GENERATION_IN_PROGRESS", "Your interview is already being prepared.");
      throw rErr;
    }
    interviewId = reserved as string;

    const questions = await generateInterview({
      ai, runner: defaultRunner({ JUDGE0_URL: Deno.env.get("JUDGE0_URL") ?? undefined, JUDGE0_AUTH_TOKEN: Deno.env.get("JUDGE0_AUTH_TOKEN") ?? undefined }),
      round, level, count, student: { branch: profile.branch, year: profile.year_of_study },
    });

    const { data: rows, error: qErr } = await ctx.admin.from("interview_questions").insert(questions.map((q) => ({
      interview_id: interviewId, user_id: ctx.userId, position: q.position, kind: q.kind, question_text: q.text, topic: q.topic, coding: q.coding,
    }))).select("id,position");
    if (qErr || !rows) throw qErr ?? new Error("question insert failed");
    const priv = questions.filter((q) => q.tests).map((q) => ({ question_id: rows.find((r) => r.position === q.position)!.id, user_id: ctx.userId, tests: q.tests }));
    if (priv.length) {
      const { error: pErr } = await ctx.admin.from("question_private").insert(priv);
      if (pErr) throw pErr;
    }
    const { error: uErr } = await ctx.admin.from("interviews").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", interviewId);
    if (uErr) throw uErr;
    return jsonResponse({ interview_id: interviewId }, 200, cors);
  } catch (e) {
    if (interviewId && admin) {
      await admin.from("interviews").update({ status: "failed", error_message: String((e as Error)?.message ?? "failed").slice(0, 300) }).eq("id", interviewId);
    }
    return errorResponse(e, cors);
  }
});
