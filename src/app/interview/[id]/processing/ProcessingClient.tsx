"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/Brand";
import { Banner, Button } from "@/components/ui";
import { ApiCallError, invokeFn } from "@/lib/api";

export function ProcessingClient({ id, roundName, answered }: { id: string; roundName: string; answered: number }) {
  const router = useRouter();
  const started = useRef(false);
  const [err, setErr] = useState<ApiCallError | null>(null);
  const [busy, setBusy] = useState(true);

  const run = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      await invokeFn("evaluate-interview", { interview_id: id });
      router.replace(`/feedback/${id}`);
    } catch (e) {
      setErr(e instanceof ApiCallError ? e : new ApiCallError("INTERNAL", "Something went wrong. Please try again."));
      setBusy(false);
    }
  }, [id, router]);

  useEffect(() => { if (!started.current) { started.current = true; run(); } }, [run]);

  const step = (state: "done" | "active" | "todo", label: string) => (
    <li className={`flex items-center gap-3 rounded-md border border-line bg-white px-4 py-3.5 text-[15px] ${state === "todo" ? "text-ink-3" : ""}`}>
      {state === "done" && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-[13px] font-bold text-white" aria-hidden="true">✓</span>}
      {state === "active" && <span className={`h-6 w-6 rounded-full border-[3px] border-saffron-400 border-t-neutral-100 ${err ? "" : "spin"}`} aria-hidden="true" />}
      {state === "todo" && <span className="h-6 w-6 rounded-full border-2 border-line-input" aria-hidden="true" />}
      {label}
    </li>
  );

  return (
    <main className="flex min-h-[calc(100dvh-69px)] items-center justify-center px-5 py-8 md:px-12">
      <div className="flex w-full max-w-[480px] flex-col items-center gap-[22px] text-center">
        <LogoMark size={80} />
        <h1 className="text-2xl font-bold md:text-[32px]">Preparing your feedback</h1>
        <p role="status" className="text-base leading-[1.55] text-ink-2">Reviewing {answered} {answered === 1 ? "answer" : "answers"} from your {roundName}. This usually takes under a minute.</p>
        <ul className="flex w-full flex-col gap-2.5 text-left">
          {step("done", "Turning your answers into text")}
          {step("active", "Scoring each answer")}
          {step("todo", "Writing tips and better answers")}
        </ul>
        {err && (
          <div className="flex w-full flex-col gap-3">
            <Banner tone="error" className="text-left">{err.message}</Banner>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={run} disabled={busy}>Try again</Button>
              <Link href="/practice" className="inline-flex h-[52px] items-center px-4 font-semibold text-teal-600">Back to practice</Link>
            </div>
            <p className="text-[13px] text-ink-3">Your answers are saved. You can come back and press Try again later.</p>
          </div>
        )}
      </div>
    </main>
  );
}
