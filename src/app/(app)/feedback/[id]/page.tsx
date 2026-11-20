import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireReady } from "@/lib/session";
import { ROUND_INFO } from "@/lib/content";
import { asStrings, band, fmtDate, isScoreMap } from "@/lib/format";
import { SUB_SCORES, type Round } from "@shared/config";
import { buttonClass } from "@/components/buttonStyles";
import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui";
import { RatingCard } from "./RatingCard";
import { ScoreRing } from "./ScoreRing";

export const metadata = { title: "Your feedback" };

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireReady();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: iv } = await supabase.from("interviews").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!iv) notFound();
  if (iv.status === "processing") redirect(`/interview/${id}/processing`);
  if (iv.status === "in_progress") redirect(`/interview/${id}`);
  if (iv.status !== "completed" || iv.score === null) redirect("/practice");

  const [{ data: qs }, { data: due }] = await Promise.all([
    supabase.from("interview_questions").select("id,position,kind,question_text,status,transcript,code_language,code_source,score,went_well,to_improve,stronger_answer").eq("interview_id", id).order("position"),
    supabase.rpc("rating_due", { p_interview_id: id }),
  ]);
  const round = iv.round as Round;
  const b = band(iv.score);
  const subs = isScoreMap(iv.sub_scores) ? SUB_SCORES[round].map((n) => [n, Number((iv.sub_scores as Record<string, number>)[n] ?? 0)] as const) : [];
  const answeredQs = (qs ?? []).filter((q) => q.status === "answered");
  const skipped = iv.skipped_count;
  const countLine = iv.ended_early ? `${iv.answered_count} answered` : `${iv.answered_count} answered, ${skipped} skipped`;
  const retry = `/practice/setup?round=${iv.round}&level=${iv.level}&dur=${iv.duration_min}`;

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-[22px] px-5 pb-10 pt-7 md:px-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-3">{fmtDate(iv.created_at)}</span>
          <h1 className="text-[28px] font-bold md:text-[40px]">Your feedback</h1>
          <span className="text-[15px] text-ink-2">{ROUND_INFO[round].name} · {iv.level} · {iv.duration_min} min · {countLine}</span>
        </div>
        {iv.ended_early && <Pill className="border border-brick-200 bg-white text-brick-500">Ended early</Pill>}
      </div>

      <div className="flex flex-wrap gap-5">
        <section className="flex flex-[1_1_340px] flex-col gap-[18px] rounded-lg border border-line bg-white p-[22px]" aria-label="Score">
          <div className="flex flex-wrap items-center gap-[18px]">
            <ScoreRing score={iv.score} color={b.fill} track={b.track} label={`Score ${iv.score} out of 100, ${b.name}`} />
            <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
              <Pill className={b.cls}>{b.name}</Pill>
              <span className="text-[15px] leading-normal text-ink-2">Compiled from your sub-scores below.</span>
            </div>
          </div>
          <ul className="flex flex-col gap-3">
            {subs.map(([name, s]) => (
              <li key={name} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm"><span className="font-medium">{name}</span><span className="font-bold">{s}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-100" role="img" aria-label={`${name}: ${s} out of 100, ${band(s).name}`}><div className="h-full rounded-full" style={{ width: `${s}%`, background: band(s).fill }} /></div>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-[1_1_340px] flex-col gap-4">
          <div className="flex flex-col gap-2.5 rounded-lg bg-teal-50 p-5"><h2 className="text-sm font-bold text-teal-600">Strengths</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-normal">{asStrings(iv.strengths).map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="flex flex-col gap-2.5 rounded-lg bg-brick-50 p-5"><h2 className="text-sm font-bold text-brick-500">Weaknesses to work on</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-normal">{asStrings(iv.weaknesses).map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="flex flex-col gap-2.5 rounded-lg bg-cream-200 p-5 text-oxblood"><h2 className="text-sm font-bold">Tips for next time</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-normal">{asStrings(iv.tips).map((x) => <li key={x}>{x}</li>)}</ul></div>
        </section>
      </div>

      <RatingCard interviewId={id} userId={user.id} due={due === true} />

      <section className="flex flex-col gap-3.5" aria-labelledby="qbq">
        <h2 id="qbq" className="text-lg font-semibold md:text-2xl">Question by question</h2>
        {answeredQs.map((q) => {
          const qb = band(q.score ?? 0);
          return (
            <article key={q.id} className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 md:p-[22px]">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <h3 className="flex-[1_1_260px] text-[17px] font-semibold">{q.question_text}</h3>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${qb.cls}`}>{q.score ?? 0} · {qb.name}</span>
              </div>
              <div className="rounded-md bg-neutral-50 px-3.5 py-3 text-sm leading-[1.6] text-ink-2"><span className="font-semibold text-ink">Your answer (transcript): </span>{q.transcript ? `“${q.transcript}”` : "No spoken answer."}</div>
              {q.code_source && (
                <details className="rounded-md bg-neutral-50 px-3.5 py-3 text-sm">
                  <summary className="font-semibold">Your code ({q.code_language})</summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-normal text-ink-2">{q.code_source}</pre>
                </details>
              )}
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-[1_1_240px] flex-col gap-1 rounded-md bg-teal-50 px-3.5 py-3"><span className="text-[13px] font-bold text-teal-600">What went well</span><span className="text-sm leading-normal">{q.went_well}</span></div>
                <div className="flex flex-[1_1_240px] flex-col gap-1 rounded-md bg-brick-50 px-3.5 py-3"><span className="text-[13px] font-bold text-brick-500">To improve</span><span className="text-sm leading-normal">{q.to_improve}</span></div>
              </div>
              <div className="flex flex-col gap-1 rounded-md bg-cream-200 px-3.5 py-3 text-oxblood"><span className="text-[13px] font-bold">A stronger answer</span><span className="text-sm leading-[1.55]">{q.stronger_answer}</span></div>
            </article>
          );
        })}
        {skipped > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-dashed border-line-input bg-white px-5 py-4">
            <span className="text-[15px] font-semibold">{skipped} {skipped === 1 ? "question was" : "questions were"} skipped</span>
            <Pill className="bg-neutral-100 text-ink-2">Skipped · not scored</Pill>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href={retry} className={buttonClass("primary", "lg", "max-md:flex-[1_1_100%]")}><Icon name="retry" size={20} />Retry this round</Link>
        <Link href="/practice" className={buttonClass("secondary", "lg", "max-md:flex-[1_1_100%]")}>Try another type</Link>
        <Link href="/history" className={buttonClass("ghost", "lg", "max-md:flex-[1_1_100%]")}>View history</Link>
      </div>
    </main>
  );
}
