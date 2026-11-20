// NVIDIA API client (OpenAI-compatible chat completions at integrate.api.nvidia.com). Runs only inside Edge Functions.
import { z } from "zod";
import type { FetchLike } from "./runner.ts";

export type AiErrorCode = "AI_NOT_CONFIGURED" | "AI_UNAVAILABLE" | "AI_BAD_OUTPUT";
export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string) { super(message); }
}

export interface AiConfig {
  apiKey?: string;
  model?: string;
  /** one model id or a comma-separated chain */
  fallbackModel?: string;
  baseUrl?: string;
  fetch?: FetchLike;
  /** per-request timeout in ms */
  timeoutMs?: number;
}

export const DEFAULT_MODEL = "google/gemma-4-31b-it";
/** Comma-separated chain tried in order after the primary. (gemma-3-* are listed by NVIDIA but 404 on chat; verified 2026-11-20.) */
export const DEFAULT_FALLBACK_MODELS = "poolside/laguna-xs-2.1,minimaxai/minimax-m3.1-flash";
const DEFAULT_BASE = "https://integrate.api.nvidia.com/v1";

/** Pull a JSON value out of a model reply (handles ```json fences and chatter around the object). */
export function extractJson(text: string): unknown {
  const t = text.trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch { /* fall through */ } }
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch { /* fall through */ } }
  throw new Error("no JSON object found");
}

interface ChatMsg { role: "system" | "user" | "assistant"; content: string }

async function callOnce(cfg: AiConfig, model: string, messages: ChatMsg[], maxTokens: number, temperature: number, jsonMode: boolean): Promise<{ status: number; text: string }> {
  const f = cfg.fetch ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 80000);
  try {
    const res = await f(`${(cfg.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model, messages, max_tokens: maxTokens, temperature, top_p: 0.95, stream: false,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    if (!res.ok) return { status: res.status, text: raw.slice(0, 300) };
    const data = JSON.parse(raw);
    const content = data?.choices?.[0]?.message?.content;
    return { status: 200, text: typeof content === "string" ? content : "" };
  } catch (e) {
    return { status: (e as Error).name === "AbortError" ? 599 : 598, text: (e as Error).message };
  } finally { clearTimeout(timer); }
}

export interface JsonRequest<S extends z.ZodTypeAny> {
  system: string; user: string; schema: S; maxTokens?: number; temperature?: number;
}

/** Ask the model for JSON, validate it with zod, retry/repair, then fall back to the secondary model. */
export async function chatJson<S extends z.ZodTypeAny>(cfg: AiConfig, req: JsonRequest<S>): Promise<z.infer<S>> {
  if (!cfg.apiKey) throw new AiError("AI_NOT_CONFIGURED", "NVIDIA_API_KEY is not set for this project");
  const models = [cfg.model || DEFAULT_MODEL, ...(cfg.fallbackModel || DEFAULT_FALLBACK_MODELS).split(",").map((m) => m.trim())]
    .filter((m, i, a) => m && a.indexOf(m) === i);
  let lastProblem = "unknown";

  for (const model of models) {
    const messages: ChatMsg[] = [{ role: "system", content: req.system }, { role: "user", content: req.user }];
    let jsonMode = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await callOnce(cfg, model, messages, req.maxTokens ?? 3000, req.temperature ?? 0.4, jsonMode);
      if (r.status === 410 || r.status === 404) { lastProblem = `model ${model} unavailable (${r.status})`; break; }   // end-of-life: next model
      if (r.status === 401 || r.status === 403) throw new AiError("AI_NOT_CONFIGURED", `NVIDIA API rejected the key (${r.status})`);
      if (r.status === 400 && jsonMode) { jsonMode = false; continue; }                                                // model without JSON mode
      if (r.status === 429 || r.status >= 500) {
        lastProblem = `NVIDIA API ${r.status}`;
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
        continue;
      }
      if (r.status !== 200) { lastProblem = `NVIDIA API ${r.status}: ${r.text}`; break; }
      try {
        const parsed = req.schema.safeParse(extractJson(r.text));
        if (parsed.success) return parsed.data;
        lastProblem = "schema: " + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ");
      } catch (e) { lastProblem = (e as Error).message; }
      // one repair round with the model's own output
      messages.push({ role: "assistant", content: r.text.slice(0, 6000) });
      messages.push({ role: "user", content: `Your previous reply was invalid (${lastProblem}). Reply again with ONLY the corrected JSON object, no commentary.` });
    }
  }
  const unavailable = /NVIDIA API|unavailable|aborted|network|fetch/i.test(lastProblem);
  throw new AiError(unavailable ? "AI_UNAVAILABLE" : "AI_BAD_OUTPUT", lastProblem);
}
