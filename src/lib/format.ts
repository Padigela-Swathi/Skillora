import { bandFor, type Band } from "@shared/scoring";

export const BAND_STYLE: Record<Band, { bg: string; fg: string; fill: string; track: string; cls: string }> = {
  "Interview ready": { bg: "#E3ECEE", fg: "#1C3238", fill: "#335C67", track: "#E3ECEE", cls: "bg-teal-100 text-teal-900" },
  "Getting there": { bg: "#FBEBD3", fg: "#6A440D", fill: "#E09F3E", track: "#FBEBD3", cls: "bg-saffron-100 text-saffron-800" },
  "Needs work": { bg: "#F8E6E4", fg: "#6A1616", fill: "#9E2A2B", track: "#F8E6E4", cls: "bg-brick-100 text-brick-700" },
};
export const band = (score: number) => { const name = bandFor(score); return { name, ...BAND_STYLE[name] }; };

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export const mmss = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export const isScoreMap = (v: unknown): v is Record<string, number> => !!v && typeof v === "object" && !Array.isArray(v);
export const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
