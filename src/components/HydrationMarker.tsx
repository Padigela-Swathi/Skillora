"use client";
import { useEffect } from "react";

/** Sets <html data-hydrated> once React has attached handlers, so E2E tests can wait for it instead of sleeping. */
export function HydrationMarker() {
  useEffect(() => { document.documentElement.dataset.hydrated = "true"; }, []);
  return null;
}
