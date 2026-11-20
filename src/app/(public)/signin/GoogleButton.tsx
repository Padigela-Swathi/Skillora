"use client";
import { useState } from "react";
import { GoogleMark } from "@/components/Icon";
import { Banner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true); setErr(null);
    // Supabase answers a disabled provider with a raw JSON page; check first so the student sees a clear message instead.
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } });
      if (res.ok && (await res.json())?.external?.google === false) {
        setErr("Google sign-in has not been switched on for this site yet. Please check back soon."); setBusy(false); return;
      }
    } catch { /* offline or blocked: let the normal flow report it */ }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setErr("Google sign-in is not available right now. Please try again later."); setBusy(false); }
  }
  return (
    <>
      <button type="button" onClick={go} disabled={busy}
        className="flex h-[52px] w-full items-center justify-center gap-3 rounded-md border border-line-input bg-white text-base font-semibold text-ink hover:bg-neutral-50 disabled:opacity-60">
        <GoogleMark />{busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {err && <Banner tone="error" className="w-full text-left">{err}</Banner>}
    </>
  );
}
