// Deno-only helpers (not imported by Node tests).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.2";
import { ApiError } from "./http.ts";

export interface Ctx { userId: string; admin: SupabaseClient }

export async function authenticate(req: Request): Promise<Ctx> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const header = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(header)) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in again.");
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: header } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in again.");
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  return { userId: data.user.id, admin };
}

export function aiConfig() {
  return {
    apiKey: Deno.env.get("NVIDIA_API_KEY") || undefined,
    model: Deno.env.get("NVIDIA_MODEL") || undefined,
    fallbackModel: Deno.env.get("NVIDIA_FALLBACK_MODEL") || undefined,
  };
}
