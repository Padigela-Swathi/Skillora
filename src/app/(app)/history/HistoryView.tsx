"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { LinkButton } from "@/components/ui";
import { ROUND_INFO } from "@/lib/content";
import { band, cx, fmtDate } from "@/lib/format";
import type { Round } from "@shared/config";

interface Row { id: string; round: string; level: string; dur: number; score: number; at: string }
const FILTERS: { id: "all" | Round; label: string }[] = [{ id: "all", label: "All" }, { id: "hr", label: "HR" }, { id: "tech", label: "Technical" }, { id: "code", label: "Coding" }, { id: "mgr", label: "Managerial" }];

export function HistoryView({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<"all" | Round>("all");
  if (rows.length === 0) {
    return (
      <main className="mx-auto flex max-w-[1200px] flex-col gap-[22px] px-5 pb-10 pt-7 md:px-12">
        <h1 className="text-[28px] font-bold md:text-[40px]">History</h1>
        <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-white px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600"><Icon name="chart" size={26} /></span>
          <h2 className="text-xl font-semibold">No interviews yet</h2>
          <p className="max-w-sm text-[15px] text-ink-2">Finish your first practice interview and your score, trend and feedback will show up here.</p>
          <LinkButton href="/practice">Start an interview</LinkButton>
        </div>
      </main>
    );
  }
  const chrono = [...rows].reverse();
  const avg = Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length);
  const first = chrono[0].score, lastScore = chrono[chrono.length - 1].score, delta = lastScore - first;
  const pts = chrono.slice(-12).map((r, i, a) => `${a.length === 1 ? 150 : Math.round((i / (a.length - 1)) * 300)},${Math.round(74 - (r.score / 100) * 68)}`).join(" ");
  const byRound = (["tech", "hr", "code", "mgr"] as Round[]).map((id) => { const rs = rows.filter((r) => r.round === id); return { id, n: rs.length, avg: rs.length ? Math.round(rs.reduce((a, r) => a + r.score, 0) / rs.length) : null }; });
  const shown = rows.filter((r) => filter === "all" || r.round === filter);

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-[22px] px-5 pb-10 pt-7 md:px-12">
      <h1 className="text-[28px] font-bold md:text-[40px]">History</h1>
      <div className="flex flex-wrap gap-5">
        <section className="flex flex-[1_1_320px] flex-col gap-2.5 rounded-lg bg-teal-600 p-[22px] text-white" aria-label="Overall performance">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-cream-200">Overall performance</span>
          <div className="flex items-baseline gap-2.5"><span className="text-[52px] font-bold leading-none">{avg}</span><span className="text-[15px] text-teal-100">across {rows.length} {rows.length === 1 ? "interview" : "interviews"}</span></div>
          <svg width="100%" height="72" viewBox="0 0 300 80" preserveAspectRatio="none" role="img" aria-label={`Score trend ${first} to ${lastScore} over ${rows.length} interviews`}>
            {chrono.length > 1 ? <polyline points={pts} fill="none" stroke="#E09F3E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : <circle cx="150" cy={Math.round(74 - (first / 100) * 68)} r="4" fill="#E09F3E" />}
          </svg>
          <span className="text-sm text-teal-100">{rows.length < 2 ? "Take more interviews to see your trend." : delta > 0 ? `Up ${delta} points since your first interview.` : delta < 0 ? `Down ${-delta} points since your first interview.` : "Same score as your first interview."}</span>
        </section>
        <section className="flex flex-[1_1_320px] flex-col gap-3 rounded-lg border border-line bg-white p-[22px]" aria-label="Average by round">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-600">Average by round</span>
          {byRound.map((a) => (
            <div key={a.id} className="flex flex-col gap-[5px]">
              <div className="flex justify-between text-sm"><span className="font-medium">{ROUND_INFO[a.id].name}</span><span className="font-bold">{a.avg === null ? "Not tried yet" : <>{a.avg} / 100<span className="sr-only"> · {band(a.avg).name}</span></>}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${a.avg ?? 0}%`, background: a.avg === null ? "transparent" : band(a.avg).fill }} /></div>
            </div>
          ))}
        </section>
      </div>
      <div role="radiogroup" aria-label="Filter by round" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}
            className={cx("h-10 rounded-full border px-4 text-sm font-semibold", filter === f.id ? "border-teal-600 bg-teal-600 text-white" : "border-line-input bg-white text-ink hover:bg-neutral-50")}>{f.label}</button>
        ))}
      </div>
      <section className="overflow-hidden rounded-lg border border-line bg-white" aria-label="Interviews">
        {shown.map((h) => {
          const b = band(h.score);
          return (
            <Link key={h.id} href={`/feedback/${h.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 px-5 py-4 text-ink last:border-b-0 hover:bg-neutral-50">
              <span className="flex flex-[1_1_200px] flex-col gap-0.5"><span className="text-base font-semibold">{ROUND_INFO[h.round as Round].name}</span><span className="text-sm text-ink-3">{fmtDate(h.at)} · {h.level} · {h.dur} min</span></span>
              <span className={`rounded-full px-3 py-[5px] text-sm font-bold ${b.cls}`}>{h.score} · {b.name}</span>
              <Icon name="chevronRight" size={18} strokeWidth={2} className="text-teal-600" />
            </Link>
          );
        })}
        {shown.length === 0 && <div className="px-5 py-7 text-center text-[15px] text-ink-3">No interviews in this round yet.</div>}
      </section>
    </main>
  );
}
