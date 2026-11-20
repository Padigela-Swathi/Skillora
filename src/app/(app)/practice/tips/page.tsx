import Link from "next/link";
import { redirect } from "next/navigation";
import { Overline, Pill } from "@/components/ui";
import { ROUND_INFO } from "@/lib/content";
import { parseSelection, selectionQuery } from "@/lib/params";
import { StartButton } from "./StartButton";

export const metadata = { title: "Before you begin" };

export default async function TipsPage({ searchParams }: { searchParams: Promise<{ round?: string; level?: string; dur?: string }> }) {
  const sel = parseSelection(await searchParams);
  if (!sel) redirect("/practice");
  const info = ROUND_INFO[sel.round];
  return (
    <main className="mx-auto flex max-w-[1196px] flex-col gap-[22px] px-5 pb-10 pt-7 md:px-12">
      <Link href={`/practice/setup?${selectionQuery(sel)}`} className="inline-flex h-10 items-center self-start text-[15px] font-semibold text-teal-600">Back</Link>
      <div className="flex flex-col gap-2.5">
        <Pill className="self-start bg-teal-100 text-teal-900">{info.name} · {sel.level} · {sel.dur} min</Pill>
        <h1 className="text-[28px] font-bold md:text-[40px]">Before you begin</h1>
      </div>
      <div className="flex flex-wrap gap-5">
        <div className="flex flex-[1_1_420px] flex-col gap-5">
          <section className="flex flex-col gap-2.5 rounded-lg border border-line bg-white p-[22px]">
            <Overline>Why this round?</Overline>
            <p className="text-base leading-[1.6]">{info.why}</p>
          </section>
          <section className="flex flex-col gap-3 rounded-lg border border-line bg-white p-[22px]">
            <Overline>Companies with this round</Overline>
            <ul className="flex flex-col gap-2.5">
              {info.companies.map((c) => (
                <li key={c.n} className="flex items-baseline gap-3 border-b border-neutral-100 pb-2.5">
                  <span className="min-w-[92px] text-[15px] font-bold">{c.n}</span>
                  <span className="text-sm leading-normal text-ink-2">{c.d}</span>
                </li>
              ))}
            </ul>
            <span className="text-xs text-ink-3">Based on recent fresher interview reports. Rounds can vary by drive and role.</span>
          </section>
        </div>
        <div className="flex flex-[1_1_320px] flex-col gap-5">
          <section className="flex flex-col gap-3 rounded-lg bg-cream-200 p-[22px] text-oxblood">
            <span className="text-xs font-semibold uppercase tracking-[0.08em]">Tips before starting</span>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-normal">{info.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
          <section className="flex flex-col gap-2.5 rounded-lg border border-line bg-white p-[22px]">
            <Overline>How it works</Overline>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-normal text-ink-2">
              <li>The interviewer reads each question aloud.</li><li>Answer out loud, then press Done answering.</li>
              <li>Aim for under 2 minutes per answer.</li><li>You can skip a question or quit any time.</li>
            </ul>
          </section>
          <StartButton round={sel.round} level={sel.level} dur={sel.dur} />
        </div>
      </div>
    </main>
  );
}
