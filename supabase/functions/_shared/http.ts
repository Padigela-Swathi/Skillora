// HTTP helpers shared by the Edge Functions.
export const CORS = (origin: string | null, allowed?: string) => {
  const list = (allowed ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const allow = list.length === 0 ? "*" : origin && list.includes(origin) ? origin : list[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json", "cache-control": "no-store" } });
}

export function errorResponse(e: unknown, cors: Record<string, string>): Response {
  if (e instanceof ApiError) return jsonResponse({ error: { code: e.code, message: e.message } }, e.status, cors);
  const code = (e as { code?: string })?.code;
  if (code === "AI_NOT_CONFIGURED") return jsonResponse({ error: { code, message: "The AI service is not configured yet. Please try again later." } }, 503, cors);
  if (code === "AI_UNAVAILABLE") return jsonResponse({ error: { code, message: "The AI service is busy right now. Please try again in a minute." } }, 503, cors);
  if (code === "AI_BAD_OUTPUT") return jsonResponse({ error: { code, message: "The AI returned an unusable reply. Please try again." } }, 502, cors);
  console.error("unhandled", (e as Error)?.message);   // message only: never log code, transcripts or tokens
  return jsonResponse({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, 500, cors);
}

export async function readJson<T>(req: Request, maxBytes = 120_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request is too large");
  try { return JSON.parse(text) as T; } catch { throw new ApiError(400, "BAD_JSON", "Request body must be JSON"); }
}
