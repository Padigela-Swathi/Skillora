"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner, Button, Field, fieldClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function DevLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) { setErr(error.message); setBusy(false); return; }
    router.push("/practice"); router.refresh();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Email">{(p) => <input id={p.id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass()} required />}</Field>
      <Field label="Password">{(p) => <input id={p.id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass()} required />}</Field>
      {err && <Banner tone="error">{err}</Banner>}
      <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
