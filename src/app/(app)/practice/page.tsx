import { notFound } from "next/navigation";
import { requireReady } from "@/lib/session";
import { fmtDate } from "@/lib/format";
import { ROUND_INFO } from "@/lib/content";
import { LEVELS, ROUNDS, DURATIONS, type Level, type Round } from "@shared/config";
import { PracticePicker } from "./PracticePicker";

export const metadata = { title: "Practice" };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ round?: string; level?: string; dur?: string }> }) {
  const { supabase, profile, user } = await requireReady();
  const sp = await searchParams;
  const round = (ROUNDS as readonly string[]).includes(sp.round ?? "") ? (sp.round as Round) : "hr";
  const level = (LEVELS as readonly string[]).includes(sp.level ?? "") ? (sp.level as Level) : "Easy";
  const dur = (DURATIONS as readonly number[]).includes(Number(sp.dur)) ? (Number(sp.dur) as 5 | 10 | 15) : 10;

  const [{ data: usage, error: uErr }, { data: last }] = await Promise.all([
    supabase.rpc("daily_usage"),
    supabase.from("interviews").select("id,round,score,created_at").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1),
  ]);
  if (uErr) notFound();
  const u = usage as { used: number; limit: number };
  const l = last?.[0];
  return (
    <PracticePicker
      firstName={profile.full_name.split(" ")[0] || "there"} remaining={Math.max(0, u.limit - u.used)} limit={u.limit}
      initial={{ round, level, dur }}
      last={l ? { id: l.id, roundName: ROUND_INFO[l.round as Round].name, score: l.score ?? 0, date: fmtDate(l.created_at) } : null}
    />
  );
}
