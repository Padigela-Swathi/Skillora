import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/legal";
import type { ProfileRow } from "@/lib/database.types";

export const profileComplete = (p: Pick<ProfileRow, "full_name" | "college" | "branch" | "year_of_study"> | null) =>
  !!p && !!p.full_name.trim() && !!p.college.trim() && !!p.branch && !!p.year_of_study;

/** Verified user (getUser() validates the JWT with Supabase Auth) + their profile. Redirects anonymous visitors. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, profile: profile as ProfileRow | null };
});

/** Signed in AND accepted the current terms AND finished the basic profile. */
export const requireReady = cache(async () => {
  const ctx = await requireUser();
  if (ctx.profile?.terms_version !== TERMS_VERSION) redirect("/onboarding/terms");
  if (!profileComplete(ctx.profile)) redirect("/onboarding/details");
  return { ...ctx, profile: ctx.profile as ProfileRow };
});
