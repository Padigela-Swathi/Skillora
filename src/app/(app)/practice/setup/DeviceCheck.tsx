"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Banner, Button, Field, fieldClass } from "@/components/ui";
import { cx } from "@/lib/format";
import { useSpeechSupported } from "@/lib/useBrowser";

type Phase = "idle" | "asking" | "ready" | "denied" | "error";
const BARS = 12;

export function DeviceCheck({ backHref, nextHref }: { backHref: string; nextHref: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const heardRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState("");
  const [micId, setMicId] = useState("");
  const [hasCam, setHasCam] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const voiceOk = useSpeechSupported();

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(async (cam?: string, mic?: string) => {
    stop(); setPhase("asking"); heardRef.current = false; setHeard(false);
    const audio: MediaTrackConstraints | boolean = mic ? { deviceId: { exact: mic } } : true;
    const video: MediaTrackConstraints | boolean = cam ? { deviceId: { exact: cam } } : true;
    let stream: MediaStream | null = null;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio, video }); }
    catch (e) {
      const name = (e as DOMException).name;
      if (name === "NotAllowedError" || name === "SecurityError") { setPhase("denied"); return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio }); }       // no camera: mic only
      catch (e2) { setPhase((e2 as DOMException).name === "NotAllowedError" ? "denied" : "error"); return; }
    }
    streamRef.current = stream;
    const a = stream.getAudioTracks()[0], v = stream.getVideoTracks()[0];
    setHasMic(!!a); setHasCam(!!v);
    if (videoRef.current) { videoRef.current.srcObject = stream; }
    const all = await navigator.mediaDevices.enumerateDevices();
    setCams(all.filter((d) => d.kind === "videoinput")); setMics(all.filter((d) => d.kind === "audioinput"));
    setCamId(v?.getSettings().deviceId ?? ""); setMicId(a?.getSettings().deviceId ?? "");
    try { sessionStorage.setItem("skillora.cam", v?.getSettings().deviceId ?? ""); sessionStorage.setItem("skillora.mic", a?.getSettings().deviceId ?? ""); } catch { /* storage unavailable */ }

    if (a) {   // live mic level meter
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx(); audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
      ctx.createMediaStreamSource(new MediaStream([a])).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0; for (const x of buf) { const d = (x - 128) / 128; sum += d * d; }
        const rms = Math.sqrt(sum / buf.length);
        const lv = Math.min(1, rms * 4);
        setLevel(lv);
        if (lv > 0.12 && !heardRef.current) { heardRef.current = true; setHeard(true); }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    }
    setPhase("ready");
  }, [stop]);

  useEffect(() => { if (phase === "ready" && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current; }, [phase]);

  const lit = phase === "ready" ? Math.round(level * BARS) : 0;
  const micMsg = phase !== "ready" ? "Allow access to test your microphone." : heard ? "We can hear you clearly." : "Say “hello Skillora” to test your microphone.";
  const ready = phase === "ready" && hasMic;

  const checks = [
    { ok: phase === "ready" && hasCam, label: "Camera working" },
    { ok: phase === "ready" && hasMic && heard, label: "Microphone working" },
    { ok: voiceOk, label: "Use Chrome for the best voice results", info: true },
  ];

  return (
    <main className="mx-auto flex max-w-[1196px] flex-col gap-[22px] px-5 pb-10 pt-7 md:px-12">
      <Link href={backHref} className="inline-flex h-10 items-center self-start text-[15px] font-semibold text-teal-600">Back</Link>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold md:text-[40px]">Check your camera and mic</h1>
        <p className="text-base leading-[1.55] text-ink-2">Your camera is only shown to you, for a real interview feel. Nothing from the camera is recorded.</p>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="relative flex h-[260px] min-w-0 flex-[1_1_460px] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-teal-800 text-teal-200 md:h-[400px]">
          {phase === "ready" ? (
            <>
              <video ref={videoRef} autoPlay muted playsInline aria-label="Your camera preview" className={cx("absolute inset-0 h-full w-full -scale-x-100 object-cover", !hasCam && "hidden")} />
              {!hasCam && <><Icon name="user" size={64} strokeWidth={1.5} /><span className="text-[15px] font-semibold text-cream-50">No camera found · microphone only</span></>}
              {hasCam && <span className="absolute left-4 top-4 rounded-full bg-teal-600 px-2.5 py-[5px] text-xs font-semibold text-white">Self view</span>}
            </>
          ) : (
            <>
              <Icon name="cameraOff" size={56} strokeWidth={1.5} />
              <span className="px-5 text-center text-[15px] font-semibold text-cream-50">{phase === "asking" ? "Waiting for your permission…" : "Camera and mic are off"}</span>
              <Button variant="accent" size="md" onClick={() => start()} disabled={phase === "asking"}>Allow camera and microphone</Button>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          {phase === "denied" && <Banner tone="error"><Icon name="warning" size={18} className="mr-2 inline" />Permission was blocked. Click the camera icon in your browser&apos;s address bar, allow camera and microphone, then press the button again.</Banner>}
          {phase === "error" && <Banner tone="error"><Icon name="warning" size={18} className="mr-2 inline" />We could not find a microphone. Connect one and try again.</Banner>}
          {!voiceOk && <Banner tone="limit">Voice recognition is not available in this browser. You can still type your answers; Chrome gives the best voice results.</Banner>}
          <Field label="Camera" bare>{(p) => (
            <select id={p.id} value={camId} disabled={phase !== "ready" || !cams.length} onChange={(e) => { setCamId(e.target.value); start(e.target.value, micId); }} className={fieldClass() + " px-3"}>
              {cams.length ? cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>) : <option>{phase === "ready" ? "No camera found" : "Allow access to see cameras"}</option>}
            </select>)}</Field>
          <Field label="Microphone" bare>{(p) => (
            <select id={p.id} value={micId} disabled={phase !== "ready" || !mics.length} onChange={(e) => { setMicId(e.target.value); start(camId, e.target.value); }} className={fieldClass() + " px-3"}>
              {mics.length ? mics.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>) : <option>Allow access to see microphones</option>}
            </select>)}</Field>
          <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-white p-4">
            <span className="text-sm font-semibold">Mic check · say “hello Skillora”</span>
            <div className="grid h-4 grid-cols-12 gap-1" aria-hidden="true">
              {Array.from({ length: BARS }, (_, i) => (
                <span key={i} className={cx("rounded-sm", i < lit ? (i === lit - 1 && lit >= 8 ? "bg-saffron-400" : "bg-teal-600") : "bg-neutral-200")} />
              ))}
            </div>
            <span role="status" className={cx("text-sm font-semibold", heard ? "text-teal-600" : "text-ink-3")}>{micMsg}</span>
          </div>
          <ul className="flex flex-col gap-2 text-[15px]">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2.5">
                <span aria-hidden="true" className={cx("flex h-[22px] w-[22px] items-center justify-center rounded-full text-[13px] font-bold text-white", c.info ? "bg-teal-400" : c.ok ? "bg-teal-600" : "bg-neutral-400")}>{c.info ? "i" : c.ok ? "✓" : ""}</span>
                {c.label}<span className="sr-only">{c.info ? "" : c.ok ? " — done" : " — not yet"}</span>
              </li>
            ))}
          </ul>
          <Button disabled={!ready} onClick={() => { stop(); router.push(nextHref); }}>Continue</Button>
        </div>
      </div>
    </main>
  );
}
