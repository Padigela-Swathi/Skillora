import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { daysLive, humanDays, pct, type ReachStats } from "@/lib/admin";
import { ROUND_INFO } from "@/lib/content";
import { cx } from "@/lib/format";
import type { Round } from "@shared/config";

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const stampLabel = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const eyebrow = "text-xs font-semibold uppercase tracking-[0.08em] text-teal-600";

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-[18px]">
      <span className={eyebrow}>{label}</span>
      <span className="text-[32px] font-bold leading-tight">{value}</span>
      {note && <span className="text-sm text-ink-3">{note}</span>}
    </Card>
  );
}

/** Single-series bar chart: thin bars with rounded tops, one baseline, hover/focus tooltip per bar, and a table view for screen readers. */
function DailyBars({ title, unit, data }: { title: string; unit: string; data: { day: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  const last = data.length - 1;
  return (
    <Card as="section" className="flex flex-col gap-3 p-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm text-ink-3">{total} in the last {data.length} days</span>
      </div>
      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between text-xs text-ink-3" aria-hidden="true"><span>{max}</span><span>0</span></div>
        <div className="relative flex h-40 flex-1 items-end border-b border-line-input" role="group" aria-label={`${title}, by day`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden="true" />
          {data.map((d, i) => (
            <div key={d.day} tabIndex={0} aria-label={`${dayLabel(d.day)}: ${d.value} ${unit}`}
              className="group relative flex h-full flex-1 items-end justify-center outline-offset-0 hover:bg-neutral-50 focus-visible:bg-neutral-50">
              {d.value > 0 && <div className="w-full max-w-[12px] rounded-t-[4px] bg-teal-600" style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }} />}
              <span role="presentation" className={cx("pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-sm bg-teal-900 px-2.5 py-1.5 text-xs font-medium text-white group-hover:block group-focus-visible:block",
                i < 4 ? "left-0" : i > last - 4 ? "right-0" : "left-1/2 -translate-x-1/2")}>{dayLabel(d.day)} · {d.value} {unit}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between pl-6 text-xs text-ink-3" aria-hidden="true">
        <span>{dayLabel(data[0].day)}</span><span>{dayLabel(data[Math.floor(last / 2)].day)}</span><span>{dayLabel(data[last].day)}</span>
      </div>
      <details className="text-sm">
        <summary className="inline-block py-1 font-semibold text-teal-600">View as table</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead><tr><th className="py-1 pr-4 font-semibold">Day</th><th className="py-1 font-semibold">{unit}</th></tr></thead>
          <tbody>{[...data].reverse().map((d) => <tr key={d.day} className="border-t border-line"><td className="py-1 pr-4">{dayLabel(d.day)}</td><td className="py-1">{d.value}</td></tr>)}</tbody>
        </table>
      </details>
    </Card>
  );
}

/** Ranked horizontal bars: label, bar and count on one row. */
function RankedBars({ title, rows, empty }: { title: string; rows: { name: string; n: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Card as="section" className="flex flex-col gap-3 p-[22px]">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-[15px] text-ink-3">{empty}</p> : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.name} className="flex flex-col gap-1">
              <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words font-medium">{r.name}</span><span className="font-bold">{r.n}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${(r.n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ReachDashboard({ stats }: { stats: ReachStats }) {
  const { users, activity, interviews } = stats;
  const live = daysLive(users.first_signup_at, new Date(stats.generated_at));
  const rounds = (Object.keys(ROUND_INFO) as Round[]).map((id) => ({ name: ROUND_INFO[id].name, n: interviews.by_round[id] ?? 0 }));
  const toRows = (m: Record<string, number>) => Object.entries(m).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-[22px] px-5 pb-10 pt-7 md:px-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold md:text-[40px]">Admin · Reach</h1>
        <p className="text-[15px] text-ink-3">How far Skillora has reached students. Totals only: no names or emails are shown. Updated {stampLabel(stats.generated_at)} IST; reload to refresh.</p>
      </div>

      <section aria-label="How long the app has been reaching users" className="flex flex-col gap-2 rounded-lg bg-teal-600 p-[22px] text-white">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-cream-200">Reaching students for</span>
        {live === null ? (
          <span className="text-[28px] font-bold leading-tight">No sign-ups yet</span>
        ) : (
          <>
            <span className="text-[44px] font-bold leading-none md:text-[52px]">{humanDays(live)}</span>
            <span className="text-[15px] text-teal-100">First student joined on {stampLabel(users.first_signup_at as string).split(",")[0]}. {users.total} {users.total === 1 ? "student has" : "students have"} signed up since, {users.new_7d} in the last 7 days.</span>
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Students signed up" value={users.total} note={`${pct(users.onboarded, users.total)}% finished onboarding`} />
        <Stat label="New in 7 days" value={users.new_7d} note={`${users.new_24h} in the last 24 hours · ${users.new_30d} in 30 days`} />
        <Stat label="Practised in 7 days" value={activity.practised_7d} note={`${activity.practised_24h} today · ${activity.practised_30d} in 30 days`} />
        <Stat label="Signed in, 7 days" value={activity.signed_in_7d} note={`${activity.signed_in_30d} in 30 days`} />
        <Stat label="Ever practised" value={activity.practised_ever} note={`${pct(activity.practised_ever, users.total)}% of sign-ups`} />
        <Stat label="Interviews started" value={interviews.started} note={`${interviews.completed} completed with a score`} />
        <Stat label="Average score" value={interviews.avg_score ?? "–"} note={interviews.avg_score === null ? "No completed interviews yet" : "out of 100"} />
        <Stat label="Average rating" value={interviews.rating_avg === null ? "–" : `${interviews.rating_avg} / 5`} note={`${interviews.rating_count} ${interviews.rating_count === 1 ? "rating" : "ratings"}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DailyBars title="New students per day" unit="sign-ups" data={stats.daily.map((d) => ({ day: d.day, value: d.signups }))} />
        <DailyBars title="Students practising per day" unit="students" data={stats.daily.map((d) => ({ day: d.day, value: d.practised }))} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankedBars title={`Top colleges (${users.colleges} reached)`} rows={stats.top_colleges.map((c) => ({ name: c.name, n: c.users }))} empty="No colleges yet." />
        <div className="flex flex-col gap-5">
          <RankedBars title="By branch" rows={toRows(stats.branches)} empty="No branch data yet." />
          <RankedBars title="By year of study" rows={toRows(stats.years)} empty="No year data yet." />
          <RankedBars title="Interviews by round" rows={rounds} empty="No interviews yet." />
        </div>
      </div>
    </main>
  );
}
