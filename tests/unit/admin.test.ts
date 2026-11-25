import { describe, expect, it } from "vitest";
import { daysLive, humanDays, pct, reachStatsSchema } from "../../src/lib/admin.ts";

describe("admin reach helpers", () => {
  it("counts the day of the first sign-up as day 1", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    expect(daysLive(null, now)).toBeNull();
    expect(daysLive("2026-11-25T01:00:00Z", now)).toBe(1);
    expect(daysLive("2026-11-24T11:00:00Z", now)).toBe(2);
    expect(daysLive("2026-11-26T00:00:00Z", now)).toBe(1);   // clock skew never goes below 1
  });

  it("formats an age as days, then months and days", () => {
    expect(humanDays(1)).toBe("1 day");
    expect(humanDays(30)).toBe("30 days");
    expect(humanDays(31)).toBe("1 month 1 day");
    expect(humanDays(60)).toBe("2 months");
    expect(humanDays(75)).toBe("2 months 15 days");
  });

  it("never divides by zero", () => {
    expect(pct(1, 0)).toBe(0);
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
  });

  it("accepts the SQL function's shape and rejects a malformed one", () => {
    const ok = {
      generated_at: "2026-11-25T10:00:00+00:00",
      users: { total: 2, onboarded: 1, new_24h: 0, new_7d: 2, new_30d: 2, colleges: 1, first_signup_at: null },
      activity: { practised_24h: 0, practised_7d: 0, practised_30d: 0, practised_ever: 0, signed_in_7d: 1, signed_in_30d: 2 },
      interviews: { started: 0, completed: 0, avg_score: null, by_round: {}, rating_count: 0, rating_avg: null },
      daily: [{ day: "2026-11-25", signups: 2, practised: 0 }], top_colleges: [{ name: "A", users: 2 }], branches: { CSE: 2 }, years: {},
    };
    expect(reachStatsSchema.safeParse(ok).success).toBe(true);
    expect(reachStatsSchema.safeParse({ ...ok, users: { ...ok.users, total: "2" } }).success).toBe(false);
    expect(reachStatsSchema.safeParse(null).success).toBe(false);
  });
});
