import { z } from "zod";
import { authenticate } from "../_shared/auth.ts";
import { ApiError, CORS, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";

const Body = z.object({ confirm: z.literal("DELETE") });

Deno.serve(async (req) => {
  const cors = CORS(req.headers.get("origin"), Deno.env.get("ALLOWED_ORIGINS"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: { code: "METHOD", message: "POST only" } }, 405, cors);
  try {
    const { userId, admin } = await authenticate(req);
    if (!Body.safeParse(await readJson(req)).success) throw new ApiError(400, "INVALID_INPUT", "Confirmation missing.");
    const { error } = await admin.auth.admin.deleteUser(userId);   // FK cascades remove every row owned by the user
    if (error) throw error;
    return jsonResponse({ deleted: true }, 200, cors);
  } catch (e) { return errorResponse(e, cors); }
});
