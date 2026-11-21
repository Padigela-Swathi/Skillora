"use client";
import { useSyncExternalStore } from "react";
import { clock } from "./clock";
import { getRecognitionCtor } from "./speech";

const noopSubscribe = () => () => {};

/** Browser capability flags that are safe for SSR/hydration (server snapshot = true, client snapshot = real value). */
export const useSpeechSupported = () => useSyncExternalStore(noopSubscribe, () => getRecognitionCtor() !== null, () => true);

/** Wall-clock "now" in ms that re-renders every second; null during SSR/hydration. Backed by a stable shared store (see clock.ts). */
export function useNow(): number | null {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
}
