"use client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export class ApiCallError extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message); }
}

const FRIENDLY: Record<string, string> = {
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  TERMS_REQUIRED: "Please accept the Terms and Privacy Policy first.",
  PROFILE_INCOMPLETE: "Please complete your profile first.",
  DAILY_LIMIT: "You have used all 3 interviews for today. Come back tomorrow.",
  GENERATION_IN_PROGRESS: "Your interview is already being prepared. Please wait a moment.",
  AI_NOT_CONFIGURED: "The AI interviewer is not available yet. Please try again later.",
  AI_UNAVAILABLE: "The AI interviewer is busy right now. Please try again in a minute.",
  AI_BAD_OUTPUT: "The AI gave an unusable reply. Please try again.",
  RUNNER_UNAVAILABLE: "The code runner is busy right now. Please try again in a moment.",
  RATE_LIMITED: "Too many runs. Wait a few seconds and try again.",
  NETWORK: "We could not reach Skillora. Check your connection and try again.",
};

/** Calls a Supabase Edge Function as the signed-in user and converts failures into friendly, typed errors. */
export async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().functions.invoke<T>(name, { body });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    let code = "INTERNAL", message = "Something went wrong. Please try again.";
    try {
      const j = await error.context.json();
      code = j?.error?.code ?? code; message = j?.error?.message ?? message;
    } catch { /* non-JSON error body */ }
    throw new ApiCallError(code, FRIENDLY[code] ?? message, error.context.status);
  }
  throw new ApiCallError("NETWORK", FRIENDLY.NETWORK);
}

export const friendlyRpcError = (message: string | undefined) => {
  const m = message ?? "";
  if (m.includes("TIME_UP")) return "Time is up for this interview.";
  if (m.includes("EMPTY_ANSWER")) return "Say or type your answer first, or press Skip.";
  if (m.includes("INTERVIEW_NOT_ACTIVE") || m.includes("ALREADY_SUBMITTED")) return "This interview has already moved on. Reloading…";
  return "We could not save that. Please try again.";
};
