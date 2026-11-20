"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Banner, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function RatingCard({ interviewId, userId, due }: { interviewId: string; userId: string; due: boolean }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (sent) return <div role="status" className="rounded-md bg-teal-100 px-[18px] py-3.5 text-[15px] font-semibold text-teal-900">Thanks for rating this feedback.</div>;
  if (!due) return null;

  async function send() {
    if (!stars) { setErr("Choose 1 to 5 stars first."); return; }
    setBusy(true); setErr(null);
    const { error } = await createClient().from("feedback_ratings").insert({ interview_id: interviewId, user_id: userId, stars, comment: comment.trim() || null });
    if (error) { setErr(error.code === "23505" ? "You have already rated this feedback." : "We could not send your rating. Please try again."); setBusy(false); if (error.code === "23505") setSent(true); return; }
    setSent(true);
  }

  return (
    <section aria-labelledby="rate-h" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-[1.5px] border-saffron-400 bg-white p-5">
      <div className="flex flex-[1_1_260px] flex-col gap-1">
        <h2 id="rate-h" className="text-base font-semibold">How useful was this feedback?</h2>
        <span className="text-sm text-ink-3">It helps us make Skillora better. We ask now and then, not every time.</span>
      </div>
      <div role="radiogroup" aria-label="Rating" className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ${n === 1 ? "star" : "stars"}`} onClick={() => setStars(n)} className="flex h-11 w-11 items-center justify-center">
            <Icon name="star" size={30} fill={n <= stars ? "#E09F3E" : "none"} stroke={n <= stars ? "#C98428" : "#A3ABA8"} />
          </button>
        ))}
      </div>
      <div className="flex flex-[1_1_100%] flex-wrap gap-2.5">
        <label htmlFor="rate-c" className="sr-only">Comment</label>
        <input id="rate-c" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Anything to add? (optional)" className="h-12 min-w-[240px] flex-[1_1_240px] rounded-sm border border-line-input bg-white px-3.5 text-base" />
        <Button size="md" onClick={send} disabled={busy} className="max-md:flex-[1_1_100%]">{busy ? "Sending…" : "Send rating"}</Button>
      </div>
      {err && <Banner tone="error" className="w-full">{err}</Banner>}
    </section>
  );
}
