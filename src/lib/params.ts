import { DURATIONS, LEVELS, ROUNDS, type Level, type Round } from "@shared/config";

export interface Selection { round: Round; level: Level; dur: 5 | 10 | 15 }

/** Validates ?round&level&dur query params; returns null when anything is missing or invalid. */
export function parseSelection(sp: { round?: string; level?: string; dur?: string }): Selection | null {
  if (!(ROUNDS as readonly string[]).includes(sp.round ?? "")) return null;
  if (!(LEVELS as readonly string[]).includes(sp.level ?? "")) return null;
  const dur = Number(sp.dur);
  if (!(DURATIONS as readonly number[]).includes(dur)) return null;
  return { round: sp.round as Round, level: sp.level as Level, dur: dur as 5 | 10 | 15 };
}
export const selectionQuery = (s: Selection) => `round=${s.round}&level=${s.level}&dur=${s.dur}`;
