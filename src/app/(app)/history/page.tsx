import { requireReady } from "@/lib/session";
import { HistoryView } from "./HistoryView";

export const metadata = { title: "History" };

export default async function HistoryPage() {
  const { supabase, user } = await requireReady();
  const { data } = await supabase.from("interviews").select("id,round,level,duration_min,score,created_at").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []).filter((r) => r.score !== null).map((r) => ({ id: r.id, round: r.round, level: r.level, dur: r.duration_min, score: r.score as number, at: r.created_at }));
  return <HistoryView rows={rows} />;
}
