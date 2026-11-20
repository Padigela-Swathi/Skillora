import { notFound, redirect } from "next/navigation";
import { PublicHeader } from "@/components/Shell";
import { requireReady } from "@/lib/session";
import { ROUND_INFO } from "@/lib/content";
import type { Round } from "@shared/config";
import { ProcessingClient } from "./ProcessingClient";

export const metadata = { title: "Preparing your feedback" };

export default async function ProcessingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireReady();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: iv } = await supabase.from("interviews").select("id,status,round,answered_count").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!iv) notFound();
  if (iv.status === "completed") redirect(`/feedback/${id}`);
  if (iv.status === "in_progress") redirect(`/interview/${id}`);
  if (iv.status !== "processing") redirect("/practice");
  return (<><PublicHeader /><ProcessingClient id={id} roundName={ROUND_INFO[iv.round as Round].name} answered={iv.answered_count} /></>);
}
