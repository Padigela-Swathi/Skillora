"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Banner, Button, Segmented } from "@/components/ui";
import { DURATION_SUB, LEVEL_HINTS, ROUND_INFO, ROUND_ORDER } from "@/lib/content";
import { band, cx } from "@/lib/format";
import { LEVELS, QUESTION_COUNT, type Level, type Round } from "@shared/config";

type Dur = 5 | 10 | 15;

export function PracticePicker({ firstName, remaining, limit, initial, last }: {
  firstName: string; remaining: number; limit: number; initial: { round: Round; level: Level; dur: Dur };
  last: { id: string; roundName: string; score: number; date: string } | null;
}) {
  const router = useRouter();
  const [round, setRound] = useState<Round>(initial.round);
  const [level, setLevel] = useState<Level>(initial.level);
  const [dur, setDur] = useState<Dur>(initial.dur);
  const info = ROUND_INFO[round];
  const out = remaining <= 0;

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 pb-10 pt-7 md:px-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold md:text-[40px]">Hi {firstName}, ready to practise?</h1>
          <p className="text-base text-ink-2">Pick a round, a level and how long you have.</p>
        </div>
        <div role="status" className="flex items-center gap-2.5 rounded-md bg-saffron-100 px-3.5 py-2.5 text-sm text-saffron-800">
          <Icon name="timer" size={18} /><span><strong>{remaining} of {limit}</strong> interviews left today</span>
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="h-round">
        <h2 id="h-round" className="text-lg font-semibold">1. Choose a round</h2>
        <div role="radiogroup" aria-label="Interview round" className="flex flex-wrap gap-3.5">
          {ROUND_ORDER.map((id) => {
            const on = id === round, r = ROUND_INFO[id];
            return (
              <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setRound(id)}
                className={cx("flex min-h-[150px] flex-[1_1_230px] flex-col gap-2 rounded-lg p-[18px] text-left text-ink", on ? "border-2 border-teal-600 bg-teal-50 shadow-2" : "border border-line bg-white hover:border-line-input")}>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-[17px] font-semibold">{r.name}</span>
                  <span className={cx("h-[22px] w-[22px] shrink-0 rounded-full bg-white", on ? "border-[6px] border-teal-600" : "border-[1.5px] border-neutral-400")} />
                </span>
                <span className="text-sm leading-normal text-ink-2">{r.desc}</span>
                <span className="mt-auto text-xs font-semibold text-teal-600">{r.meta}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-6">
        <section className="flex flex-[1_1_300px] flex-col gap-3">
          <h2 className="text-lg font-semibold">2. Difficulty</h2>
          <Segmented label="Difficulty" options={LEVELS} value={level} onChange={setLevel} size="lg" full />
          <span className="text-sm leading-normal text-ink-3">{LEVEL_HINTS[level]}</span>
        </section>
        <section className="flex flex-[1_1_300px] flex-col gap-3">
          <h2 className="text-lg font-semibold">3. Duration</h2>
          <div role="radiogroup" aria-label="Duration" className="flex gap-2.5">
            {([5, 10, 15] as Dur[]).map((d) => {
              const on = d === dur;
              return (
                <button key={d} type="button" role="radio" aria-checked={on} onClick={() => setDur(d)}
                  className={cx("flex h-[60px] flex-1 flex-col items-center justify-center rounded-md text-ink", on ? "border-2 border-saffron-400 bg-saffron-50" : "border border-line-input bg-white hover:bg-neutral-50")}>
                  <span className="text-base font-bold">{d} min</span><span className="text-xs text-ink-2">{DURATION_SUB[d]}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {out && <Banner tone="limit">You have used all {limit} interviews for today. Your allowance resets at midnight (India time).</Banner>}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-white px-5 py-[18px]">
        <div className="flex flex-col gap-1"><span className="text-[13px] text-ink-3">Your interview</span>
          <span className="text-lg font-semibold">{info.name} · {level} · {dur} min · about {QUESTION_COUNT[dur]} questions</span></div>
        <Button disabled={out} onClick={() => router.push(`/practice/setup?round=${round}&level=${level}&dur=${dur}`)} className="max-md:w-full">Continue</Button>
      </div>

      {last && (
        <Link href={`/feedback/${last.id}`} className="flex items-center gap-3.5 rounded-lg border border-line bg-teal-50 px-[18px] py-4 text-ink">
          <span className="text-[28px] font-bold text-teal-600">{last.score}</span>
          <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Last interview · {last.roundName}</span><span className="text-sm text-ink-3">{last.date} · {band(last.score).name} · view feedback</span></span>
          <Icon name="chevronRight" size={20} className="text-teal-600" strokeWidth={2} />
        </Link>
      )}
    </main>
  );
}
