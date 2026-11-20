"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner, Button, Spinner } from "@/components/ui";
import { ApiCallError, invokeFn } from "@/lib/api";

export function StartButton({ round, level, dur }: { round: string; level: string; dur: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiCallError | null>(null);

  async function start() {
    setBusy(true); setErr(null);
    try {
      const r = await invokeFn<{ interview_id: string }>("start-interview", { round, level, duration: dur });
      router.push(`/interview/${r.interview_id}`);
    } catch (e) {
      setErr(e instanceof ApiCallError ? e : new ApiCallError("INTERNAL", "Something went wrong. Please try again."));
      setBusy(false);
    }
  }

  return (
    <>
      {err && (
        <Banner tone="error">
          {err.message}
          {err.code === "DAILY_LIMIT" && <> <Link href="/practice" className="font-semibold underline">Back to practice</Link></>}
          {err.code === "TERMS_REQUIRED" && <> <Link href="/onboarding/terms" className="font-semibold underline">Review terms</Link></>}
          {err.code === "PROFILE_INCOMPLETE" && <> <Link href="/settings" className="font-semibold underline">Open settings</Link></>}
        </Banner>
      )}
      <Button size="lg" onClick={start} disabled={busy} className="h-14 text-[17px]">{err ? "Try again" : "I am ready, start interview"}</Button>
      {busy && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6 text-center text-cream-50" style={{ background: "rgba(20,38,43,0.92)" }}>
          <Spinner size={44} />
          <p className="text-xl font-semibold">Preparing your interview…</p>
          <p className="max-w-sm text-[15px] text-teal-200">Riya is writing questions for you. This usually takes under a minute. Coding rounds take a little longer while we test the problems.</p>
        </div>
      )}
    </>
  );
}
