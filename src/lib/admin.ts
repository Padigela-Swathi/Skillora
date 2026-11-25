import { z } from "zod";

const count = z.number().int().nonnegative();

/** Shape returned by the `admin_reach_stats()` SQL function. Parsed so a schema drift fails loudly instead of rendering NaN. */
export const reachStatsSchema = z.object({
  generated_at: z.string(),
  users: z.object({
    total: count, onboarded: count, new_24h: count, new_7d: count, new_30d: count, colleges: count,
    first_signup_at: z.string().nullable(),
  }),
  activity: z.object({
    practised_24h: count, practised_7d: count, practised_30d: count, practised_ever: count,
    signed_in_7d: count, signed_in_30d: count,
  }),
  interviews: z.object({
    started: count, completed: count, avg_score: z.number().nullable(), by_round: z.record(z.string(), count),
    rating_count: count, rating_avg: z.number().nullable(),
  }),
  daily: z.array(z.object({ day: z.string(), signups: count, practised: count })),
  top_colleges: z.array(z.object({ name: z.string(), users: count })),
  branches: z.record(z.string(), count),
  years: z.record(z.string(), count),
});
export type ReachStats = z.infer<typeof reachStatsSchema>;

const DAY_MS = 86_400_000;

/** Whole days between two instants, counting the first day as day 1 ("live for 1 day" on the day of the first sign-up). */
export function daysLive(firstSignupAt: string | null, now: Date): number | null {
  if (!firstSignupAt) return null;
  const diff = now.getTime() - new Date(firstSignupAt).getTime();
  return Math.max(1, Math.floor(diff / DAY_MS) + 1);
}

/** "3 days", "1 month 12 days": a readable age for the headline. */
export function humanDays(days: number): string {
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"}`;
  const months = Math.floor(days / 30), rest = days - months * 30;
  const m = `${months} ${months === 1 ? "month" : "months"}`;
  return rest ? `${m} ${rest} ${rest === 1 ? "day" : "days"}` : m;
}

/** Percentage rounded to a whole number; 0 when there is nothing to divide by. */
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
