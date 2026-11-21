"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InterviewerAvatar, LogoMark } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { Banner, Button, Dialog } from "@/components/ui";
import { friendlyRpcError } from "@/lib/api";
import { cx, mmss } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useNow } from "@/lib/useBrowser";
import { speak, useDictation } from "@/lib/useDictation";
import { STARTERS } from "@shared/starters";
import type { Language } from "@shared/config";
import type { CodingPublic } from "@shared/interview_gen";
import { CodePanel } from "./CodePanel";

export interface RoomQuestion { id: string; position: number; kind: "spoken" | "coding"; text: string; status: "pending" | "answered" | "skipped"; coding: CodingPublic | null }
interface RoomInterview { id: string; roundName: string; level: string; durationMin: number; total: number; startedAt: string }

const SOFT_LIMIT = 120;

export function InterviewRoom({ interview, questions }: { interview: RoomInterview; questions: RoomQuestion[] }) {
  const router = useRouter();
  const [qs, setQs] = useState(questions);
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [asking, setAsking] = useState(false);
  const [lang, setLang] = useState<Language>("python");
  const [sources, setSources] = useState<Record<string, string>>({});
  const [answerStart, setAnswerStart] = useState<number | null>(null);

  const dict = useDictation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camOk, setCamOk] = useState(false);
  const speechRef = useRef<{ cancel: () => void } | null>(null);

  const current = useMemo(() => qs.find((q) => q.status === "pending") ?? null, [qs]);
  const handled = qs.filter((q) => q.status !== "pending").length;
  const endAt = new Date(interview.startedAt).getTime() + interview.durationMin * 60_000;
  const timeLeft = now === null ? null : Math.max(0, Math.round((endAt - now) / 1000));
  const timeUp = timeLeft === 0;
  const isCode = current?.kind === "coding" && !!current.coding;
  const useTyping = typing || !dict.supported || dict.error !== null;

  /* self-view (never recorded, never uploaded) */
  useEffect(() => {
    let stream: MediaStream | null = null; let cancelled = false;
    (async () => {
      try {
        const cam = sessionStorage.getItem("skillora.cam");
        stream = await navigator.mediaDevices.getUserMedia({ video: cam ? { deviceId: { ideal: cam } } : true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamOk(true);
      } catch { setCamOk(false); }
    })();
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  /* new question: reset answer state, read it aloud, then listen */
  const currentId = current?.id;
  const currentText = current?.text;
  const dictStart = dict.start, dictStop = dict.stop, dictReset = dict.reset;
  // Per-question state is reset while rendering (React's "adjust state when a prop changes" pattern), not in an effect.
  const [stageId, setStageId] = useState(currentId);
  if (stageId !== currentId) { setStageId(currentId); setTyped(""); setTyping(false); setError(null); setAnswerStart(now); setAsking(true); }
  if (answerStart === null && now !== null) setAnswerStart(now);
  useEffect(() => {
    if (!currentId || !currentText) return;
    dictStop(); dictReset();
    let alive = true;
    const s = speak(currentText);
    speechRef.current = s;
    s.done.then(() => { if (!alive) return; setAsking(false); dictStart(); });
    return () => { alive = false; s.cancel(); dictStop(); };
  }, [currentId, currentText, dictStart, dictStop, dictReset]);

  const replay = () => {
    if (!current) return;
    speechRef.current?.cancel(); dict.stop(); setAsking(true);
    const s = speak(current.text); speechRef.current = s;
    s.done.then(() => { setAsking(false); if (!typing) dict.start(); });
  };

  const goAfterFinish = useCallback((status: string) => {
    if (status === "processing") router.replace(`/interview/${interview.id}/processing`);
    else if (status === "abandoned" || status === "failed") router.replace("/practice");
    else router.refresh();
  }, [router, interview.id]);

  const finish = useCallback(async (quit: boolean) => {
    speechRef.current?.cancel(); dictStop();
    const { data, error: e } = await createClient().rpc("finish_interview", { p_interview_id: interview.id, p_quit: quit });
    if (e) { setError("We could not end the interview. Please try again."); setBusy(false); return; }
    goAfterFinish((data as { status: string }).status);
  }, [dictStop, goAfterFinish, interview.id]);

  const code = current?.coding ? (sources[`${current.id}:${lang}`] ?? current.coding.starters?.[lang] ?? STARTERS[lang]) : "";
  const starter = current?.coding ? (current.coding.starters?.[lang] ?? STARTERS[lang]) : "";

  async function submit(action: "answer" | "skip") {
    if (!current || busy) return;
    setError(null);
    dict.stop(); speechRef.current?.cancel();
    const transcript = (useTyping ? typed : [dict.text, dict.interim].filter(Boolean).join(" ")).trim();
    const hasCode = isCode && code.trim() !== "" && code !== starter;
    if (action === "answer" && !transcript && !hasCode) { setError("Say or type your answer first, or press Skip."); if (!useTyping) dict.start(); return; }
    setBusy(true);
    const { data, error: e } = await createClient().rpc("submit_answer", {
      p_question_id: current.id, p_action: action,
      ...(action === "answer" ? { p_transcript: transcript, ...(hasCode ? { p_code_language: lang, p_code_source: code } : {}) } : {}),
    });
    if (e) {
      if (e.message.includes("TIME_UP")) { await finish(false); return; }
      setError(friendlyRpcError(e.message)); setBusy(false);
      if (/INTERVIEW_NOT_ACTIVE|ALREADY_SUBMITTED/.test(e.message)) setTimeout(() => router.refresh(), 1200);
      return;
    }
    const r = data as { answered: number; skipped: number; remaining: number };
    setQs((prev) => prev.map((q) => (q.id === current.id ? { ...q, status: action === "answer" ? "answered" : "skipped" } : q)));
    const out = r.remaining === 0 || Date.now() >= endAt;
    if (!out) { setBusy(false); return; }
    if (r.answered === 0) { setBusy(false); setLeaveOpen(true); return; }   // every question skipped
    await finish(false);
  }

  async function quit() {
    if (busy) return;
    setBusy(true);
    await finish(true);   // one click, no confirmation (product rule)
  }

  const elapsed = now === null || answerStart === null ? 0 : Math.max(0, Math.floor((now - answerStart) / 1000));
  const wrapUp = elapsed >= 105;
  const total = interview.total;
  const progress = total ? Math.min(100, (handled / total) * 100) : 0;

  const listening = !useTyping && dict.listening && !asking;
  const chip = asking ? "Riya is asking…" : useTyping ? "Type your answer" : listening ? "Listening to you" : "Microphone paused";

  if (!current) {   // all questions handled; waiting for navigation
    return <main className="on-dark flex min-h-dvh items-center justify-center bg-teal-950 text-cream-50"><p role="status">Wrapping up your interview…</p>
      <Dialog open={leaveOpen} onClose={() => {}} title="Leave this interview?" actions={<Button onClick={() => finish(false)}>Leave interview</Button>}>You skipped every question, so there is nothing to give feedback on. This interview will not count towards today&apos;s limit.</Dialog></main>;
  }

  return (
    <main className="on-dark flex min-h-dvh flex-col bg-teal-950 text-cream-50">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-3.5 py-3 md:px-12">
        <div className="flex min-w-0 items-center gap-2.5"><LogoMark size={28} /><span className="truncate text-sm font-semibold">{interview.roundName} · {interview.level}</span></div>
        <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-saffron-400 px-3 py-1.5 text-sm font-bold tabular-nums text-teal-900">
          <Icon name="timer" size={16} strokeWidth={2} />{timeLeft === null ? "--:--" : timeUp ? "Time up" : `${mmss(timeLeft)} left`}
        </span>
      </div>
      <div className="h-1.5 bg-neutral-800" role="progressbar" aria-label="Interview progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={handled}><div className="h-full bg-saffron-400" style={{ width: `${progress}%` }} /></div>

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-wrap items-stretch gap-5 p-3.5 md:px-12 md:py-6">
        <div className="flex min-w-0 flex-col gap-3.5" style={{ flex: isCode ? "1 1 480px" : "1 1 100%" }}>
          <div className={cx("relative flex items-end justify-center overflow-hidden rounded-xl bg-teal-800", isCode ? "h-[170px] md:h-[300px]" : "h-[300px] md:h-[440px]")}>
            <div className={isCode ? "hidden md:block" : "hidden"}><InterviewerAvatar width={200} height={230} /></div>
            <div className={isCode ? "md:hidden" : "hidden"}><InterviewerAvatar width={120} height={140} /></div>
            <div className={isCode ? "hidden" : "hidden md:block"}><InterviewerAvatar width={300} height={345} /></div>
            <div className={isCode ? "hidden" : "md:hidden"}><InterviewerAvatar width={210} height={240} /></div>
            <span className="absolute left-3.5 top-3.5 flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: "rgba(255,252,243,0.14)" }}>
              <span className="flex h-3.5 items-end gap-[3px]" aria-hidden="true">{[8, 14, 10].map((h, i) => <span key={i} className={cx("w-[3px] rounded-sm bg-saffron-400", (asking || listening) && "origin-bottom")} style={{ height: h, animation: asking || listening ? `bars 0.9s ease-in-out ${i * 0.15}s infinite` : undefined }} />)}</span>
              <span role="status">{chip}</span>
            </span>
            <span className="absolute right-3.5 top-3.5 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: "rgba(255,252,243,0.14)" }}>Riya · AI interviewer</span>
            <div className="absolute bottom-3.5 right-3.5 flex h-16 w-[84px] flex-col items-center justify-center gap-1 overflow-hidden rounded-[14px] border-2 bg-neutral-800 text-teal-200 md:h-[120px] md:w-[180px]" style={{ borderColor: "rgba(255,252,243,0.3)" }}>
              <video ref={videoRef} autoPlay muted playsInline aria-label="Your self view" className={cx("absolute inset-0 h-full w-full -scale-x-100 object-cover", !camOk && "hidden")} />
              {!camOk && <><Icon name="user" size={28} /><span className="text-xs font-semibold">You</span></>}
            </div>
          </div>

          <section className="flex flex-col gap-2 rounded-lg bg-page p-4 text-ink md:p-[22px]" aria-label="Current question">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-teal-600">Question {current.position} of {total}</span>
              <span className="flex items-center gap-2">
                <button type="button" onClick={replay} aria-label="Read the question aloud again" className="flex h-8 w-8 items-center justify-center rounded-full text-teal-600 hover:bg-teal-100"><Icon name="speaker" size={18} /></button>
                <span className="rounded-full bg-saffron-100 px-2.5 py-1 text-xs font-semibold text-saffron-800">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} on this answer{elapsed >= SOFT_LIMIT ? " · over the 2 minute limit" : wrapUp ? " · start wrapping up" : ""}</span>
              </span>
            </div>
            {isCode && current.coding ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-lg font-semibold leading-[1.4] md:text-[22px]">{current.coding.title}</p>
                <p className="text-[15px] leading-relaxed text-ink-2">{current.coding.statement}</p>
                <dl className="grid gap-1 text-sm text-ink-2">
                  <div><dt className="inline font-semibold text-ink">Input: </dt><dd className="inline">{current.coding.input_format}</dd></div>
                  <div><dt className="inline font-semibold text-ink">Output: </dt><dd className="inline">{current.coding.output_format}</dd></div>
                  {current.coding.constraints && <div><dt className="inline font-semibold text-ink">Constraints: </dt><dd className="inline">{current.coding.constraints}</dd></div>}
                </dl>
                <div className="flex flex-wrap gap-2.5">
                  {current.coding.examples.map((ex, i) => (
                    <div key={i} className="min-w-[140px] flex-1 rounded-md bg-neutral-100 p-2.5 font-mono text-[13px] leading-snug">
                      <div className="mb-1 font-sans text-xs font-semibold text-ink-3">Example {i + 1}</div>
                      <div><span className="text-ink-3">in:</span> <span className="whitespace-pre-wrap">{ex.input.trimEnd()}</span></div>
                      <div><span className="text-ink-3">out:</span> <span className="whitespace-pre-wrap">{ex.output}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-lg font-semibold leading-[1.4] md:text-[22px]">{current.text}</p>
            )}
          </section>

          <section aria-label="Your answer" className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-teal-800 p-4 md:p-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-cream-200">
                <span className={cx("h-2 w-2 rounded-full bg-brick-300", listening && "animate-pulse")} aria-hidden="true" />Your answer · {useTyping ? "typed" : "live"}
              </span>
              {useTyping ? <span className="text-xs text-teal-200">Type your answer below</span>
                : <button type="button" onClick={() => { setTyped([dict.text, dict.interim].filter(Boolean).join(" ")); dict.stop(); setTyping(true); }} className="text-xs font-semibold text-teal-200 underline underline-offset-2">Type or edit instead</button>}
            </div>
            {!dict.supported && <p className="text-[13px] text-teal-200">Voice recognition is not available in this browser, so please type your answer. Chrome works best for voice.</p>}
            {dict.error === "denied" && <p className="text-[13px] text-brick-200">Microphone access for voice recognition was blocked. Type your answer, or allow the microphone in your browser and reload.</p>}
            {dict.error === "network" && <p className="text-[13px] text-brick-200">Voice recognition could not connect. Type your answer instead.</p>}
            {dict.error === "no-mic" && <p className="text-[13px] text-brick-200">No microphone was found. Type your answer instead.</p>}
            {useTyping ? (
              <>
                <label htmlFor="typed-answer" className="sr-only">Your answer</label>
                <textarea id="typed-answer" value={typed} onChange={(e) => setTyped(e.target.value)} rows={5} maxLength={7500} placeholder="Type your answer here…"
                  className="min-h-[110px] w-full resize-y rounded-md border border-teal-500 bg-teal-900 p-3 text-[15px] leading-relaxed text-cream-50 placeholder:text-teal-300 md:text-[17px]" />
              </>
            ) : (
              <p aria-live="polite" aria-atomic="false" className="min-h-[3.2em] text-[15px] leading-[1.6] text-cream-50 md:text-[17px]">
                {dict.text}{dict.interim && <span className="text-teal-200"> {dict.interim}</span>}
                {!dict.text && !dict.interim && <span className="text-teal-300">{asking ? "Listen to the question, then answer out loud." : "Start speaking. Your words appear here."}</span>}
                <span className="caret ml-[3px] inline-block h-[1.1em] w-0.5 bg-saffron-400 align-text-bottom" aria-hidden="true" />
              </p>
            )}
          </section>
          {timeUp && <Banner tone="limit" role="status">Time is up. Finish your answer, then press Done and your feedback will be prepared.</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
        </div>

        {isCode && current.coding && (
          <CodePanel key={current.id} questionId={current.id} language={lang} source={code} disabled={busy}
            onLanguage={setLang} onSource={(s) => setSources((p) => ({ ...p, [`${current.id}:${lang}`]: s }))} />
        )}
      </div>

      <div className="sticky bottom-0 border-t border-neutral-800 bg-teal-950">
        <div className="mx-auto flex max-w-[1296px] items-center justify-between gap-2.5 px-3.5 py-3.5 md:px-12">
          <button type="button" onClick={quit} disabled={busy} className="inline-flex h-[52px] items-center gap-2 rounded-md border-[1.5px] border-brick-300 px-3.5 text-base font-semibold text-brick-100 hover:bg-brick-900/40 disabled:opacity-50 md:px-[22px]"><Icon name="close" size={20} />Quit</button>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => submit("skip")} disabled={busy} className="inline-flex h-[52px] items-center gap-2 rounded-md bg-neutral-800 px-3.5 text-base font-semibold text-cream-50 hover:bg-neutral-700 disabled:opacity-50 md:px-[22px]"><Icon name="skip" size={20} />Skip</button>
            <button type="button" onClick={() => submit("answer")} disabled={busy} className="inline-flex h-[52px] items-center gap-2 rounded-md bg-saffron-400 px-3.5 text-base font-bold text-teal-900 hover:bg-saffron-300 disabled:opacity-60 md:px-[22px]">
              <Icon name="check" size={20} strokeWidth={2} /><span className="md:hidden">Done</span><span className="hidden md:inline">Done answering</span>
            </button>
          </div>
        </div>
      </div>

      <Dialog open={leaveOpen} onClose={() => {}} title="Leave this interview?" actions={<Button onClick={() => { setBusy(true); finish(false); }}>Leave interview</Button>}>
        You skipped every question, so there is nothing to give feedback on. This interview will not count towards today&apos;s limit.
      </Dialog>
    </main>
  );
}
