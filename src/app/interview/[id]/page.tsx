import { notFound, redirect } from "next/navigation";
import { requireReady } from "@/lib/session";
import { ROUND_INFO } from "@/lib/content";
import type { CodingPublic } from "@shared/interview_gen";
import type { Round } from "@shared/config";
import { InterviewRoom, type RoomQuestion } from "./InterviewRoom";

export const metadata = { title: "Interview" };

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireReady();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: iv } = await supabase.from("interviews").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!iv) notFound();
  if (iv.status === "processing") redirect(`/interview/${id}/processing`);
  if (iv.status === "completed") redirect(`/feedback/${id}`);
  if (iv.status !== "in_progress" || !iv.started_at) redirect("/practice");

  const { data: qs } = await supabase.from("interview_questions").select("id,position,kind,question_text,status,coding").eq("interview_id", id).order("position");
  if (!qs || qs.length === 0) redirect("/practice");
  const questions: RoomQuestion[] = qs.map((q) => ({
    id: q.id, position: q.position, kind: q.kind as "spoken" | "coding", text: q.question_text,
    status: q.status as RoomQuestion["status"], coding: (q.coding as unknown as CodingPublic | null) ?? null,
  }));
  return (
    <InterviewRoom
      interview={{ id, roundName: ROUND_INFO[iv.round as Round].name, level: iv.level, durationMin: iv.duration_min, total: iv.question_count, startedAt: iv.started_at }}
      questions={questions}
    />
  );
}
