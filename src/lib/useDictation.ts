"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getRecognitionCtor, type SpeechRecognitionLike } from "./speech";
import { useSpeechSupported } from "./useBrowser";

export type DictationError = "denied" | "no-mic" | "network" | null;

/**
 * Live speech-to-text via the browser's Web Speech API. Chrome stops a session after silence, so it is restarted
 * while the student is still answering. Audio is never uploaded by Skillora; only the transcript text is submitted.
 */
export function useDictation() {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const finalRef = useRef("");
  const supported = useSpeechSupported();
  const [listening, setListening] = useState(false);
  const [text, setTextState] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<DictationError>(null);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN"; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current = (finalRef.current + " " + r[0].transcript).replace(/\s+/g, " ").trim();
        else interimText += r[0].transcript;
      }
      setTextState(finalRef.current); setInterim(interimText.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { wantRef.current = false; setError("denied"); setListening(false); }
      else if (e.error === "audio-capture") { wantRef.current = false; setError("no-mic"); setListening(false); }
      else if (e.error === "network") { wantRef.current = false; setError("network"); setListening(false); }
      // "no-speech" / "aborted": harmless, onend restarts
    };
    rec.onend = () => {
      setInterim("");
      if (wantRef.current) { try { rec.start(); } catch { /* already started */ } } else setListening(false);
    };
    recRef.current = rec;
    return () => { wantRef.current = false; rec.onend = null; try { rec.abort(); } catch { /* noop */ } };
  }, []);

  const start = useCallback(() => {
    if (!recRef.current || wantRef.current) return;
    wantRef.current = true; setError(null);
    try { recRef.current.start(); setListening(true); } catch { /* already started */ }
  }, []);
  const stop = useCallback(() => { wantRef.current = false; try { recRef.current?.stop(); } catch { /* noop */ } setListening(false); setInterim(""); }, []);
  const reset = useCallback(() => { finalRef.current = ""; setTextState(""); setInterim(""); }, []);
  const setText = useCallback((v: string) => { finalRef.current = v; setTextState(v); }, []);

  return { supported, listening, text, interim, error, start, stop, reset, setText };
}

/** Speaks the question aloud (interviewer voice). Resolves when finished; never rejects. */
export function speak(text: string): { done: Promise<void>; cancel: () => void } {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return { done: Promise.resolve(), cancel: () => {} };
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  u.voice = voices.find((v) => /en-IN/i.test(v.lang)) ?? voices.find((v) => /female|samantha|zira|google uk english female/i.test(v.name)) ?? voices[0] ?? null;
  u.rate = 0.95; u.pitch = 1.05;
  let finished = false;
  const done = new Promise<void>((resolve) => {
    const end = () => { if (!finished) { finished = true; resolve(); } };
    u.onend = end; u.onerror = end;
    setTimeout(end, Math.min(25000, 2500 + text.length * 90));   // some browsers never fire onend
  });
  synth.speak(u);
  return { done, cancel: () => { finished = true; synth.cancel(); } };
}
