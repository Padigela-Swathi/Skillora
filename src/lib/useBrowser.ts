"use client";
import { useSyncExternalStore } from "react";
import { getRecognitionCtor } from "./speech";

const noopSubscribe = () => () => {};

/** Browser capability flags that are safe for SSR/hydration (server snapshot = true, client snapshot = real value). */
export const useSpeechSupported = () => useSyncExternalStore(noopSubscribe, () => getRecognitionCtor() !== null, () => true);

let tick = 0;
/** Wall-clock "now" in ms that re-renders every `intervalMs`; null during SSR/hydration. */
export function useNow(intervalMs = 1000): number | null {
  return useSyncExternalStore(
    (cb) => { tick = Date.now(); const t = setInterval(() => { tick = Date.now(); cb(); }, intervalMs); queueMicrotask(cb); return () => clearInterval(t); },
    () => tick || null,
    () => null,
  );
}
