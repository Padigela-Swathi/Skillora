"use client";
import { useState } from "react";
import { Icon, PlayIcon } from "@/components/Icon";
import { ApiCallError, invokeFn } from "@/lib/api";
import { cx } from "@/lib/format";
import { LANGUAGES, type Language } from "@shared/config";

export const LANGUAGE_LABEL: Record<Language, string> = { python: "Python", java: "Java", cpp: "C++", c: "C", javascript: "JavaScript" };

interface TestOutcome { index: number; visible: boolean; passed: boolean; status: string; input?: string; expected?: string; actual?: string; error?: string }
type Output =
  | { kind: "idle" }
  | { kind: "busy"; mode: "compile" | "run" }
  | { kind: "compile"; ok: boolean; text: string }
  | { kind: "run"; passed: number; total: number; compileError: string | null; tests: TestOutcome[] }
  | { kind: "error"; message: string };

const clip = (s: string, n = 140) => (s.length > n ? s.slice(0, n) + "…" : s).replace(/\n/g, "⏎");

export function CodePanel({ questionId, language, source, onLanguage, onSource, disabled }: {
  questionId: string; language: Language; source: string;
  onLanguage: (l: Language) => void; onSource: (s: string) => void; disabled?: boolean;
}) {
  const [out, setOut] = useState<Output>({ kind: "idle" });
  const busy = out.kind === "busy";

  async function exec(mode: "compile" | "run") {
    if (!source.trim()) { setOut({ kind: "error", message: "Write some code first." }); return; }
    setOut({ kind: "busy", mode });
    try {
      if (mode === "compile") {
        const r = await invokeFn<{ ok: boolean; output: string }>("run-code", { question_id: questionId, language, mode, source });
        setOut({ kind: "compile", ok: r.ok, text: r.output });
      } else {
        const r = await invokeFn<{ passed: number; total: number; compile_error: string | null; tests: TestOutcome[] }>("run-code", { question_id: questionId, language, mode, source });
        setOut({ kind: "run", passed: r.passed, total: r.total, compileError: r.compile_error, tests: r.tests });
      }
    } catch (e) {
      setOut({ kind: "error", message: e instanceof ApiCallError ? e.message : "Something went wrong. Please try again." });
    }
  }

  const lines: { t: string; c: string }[] = [];
  let label = "Output", labelColor = "#C3D5DA";
  if (out.kind === "idle") lines.push({ t: "Press Compile to check for errors, or Run to test your code.", c: "#C3D5DA" });
  if (out.kind === "busy") { label = out.mode === "compile" ? "Compiling…" : "Running your code…"; lines.push({ t: "This can take a few seconds.", c: "#C3D5DA" }); }
  if (out.kind === "error") { label = "Could not run"; labelColor = "#DA8E8C"; lines.push({ t: out.message, c: "#DA8E8C" }); }
  if (out.kind === "compile") {
    label = `Compile · ${out.ok ? "success" : "failed"}`; labelColor = out.ok ? "#C3D5DA" : "#DA8E8C";
    if (out.ok) lines.push({ t: "Compiled successfully. No syntax errors found.", c: "#C3D5DA" });
    else out.text.split("\n").filter(Boolean).slice(0, 8).forEach((t) => lines.push({ t, c: "#DA8E8C" }));
  }
  if (out.kind === "run") {
    label = `Run · ${out.passed} of ${out.total} tests passed`; labelColor = out.passed === out.total ? "#C3D5DA" : "#DA8E8C";
    if (out.compileError) { lines.push({ t: "Compilation failed:", c: "#DA8E8C" }); out.compileError.split("\n").filter(Boolean).slice(0, 6).forEach((t) => lines.push({ t, c: "#DA8E8C" })); }
    else out.tests.forEach((t, i) => {
      const name = t.visible ? `Example ${i + 1}` : `Hidden test ${i + 1}`;
      if (t.passed) lines.push({ t: `✓ ${name}: passed`, c: "#C3D5DA" });
      else if (t.status === "timeout") lines.push({ t: `✗ ${name}: time limit exceeded`, c: "#DA8E8C" });
      else if (t.status === "runtime_error") lines.push({ t: `✗ ${name}: runtime error${t.error ? " · " + clip(t.error.split("\n").filter(Boolean).slice(-1)[0] ?? "", 100) : ""}`, c: "#DA8E8C" });
      else if (t.visible) lines.push({ t: `✗ ${name}: expected ${clip(t.expected ?? "")}, got ${clip(t.actual ?? "") || "(nothing)"}`, c: "#DA8E8C" });
      else lines.push({ t: `✗ ${name}: wrong answer`, c: "#DA8E8C" });
    });
  }

  return (
    <div className="flex min-w-0 flex-[1_1_480px] flex-col overflow-hidden rounded-lg border border-neutral-800 bg-teal-900">
      <div className="flex items-center justify-between gap-2.5 border-b border-neutral-800 px-3.5 py-2.5">
        <span className="text-[13px] font-semibold text-teal-200">Code editor</span>
        <label className="flex items-center gap-2 text-[13px] text-teal-200">Language
          <select value={language} onChange={(e) => onLanguage(e.target.value as Language)} disabled={disabled || busy}
            className="h-9 rounded-sm border border-teal-500 bg-teal-800 px-2 text-sm text-cream-50">
            {LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
          </select>
        </label>
      </div>
      <label htmlFor="code-area" className="sr-only">Your code ({LANGUAGE_LABEL[language]})</label>
      <textarea id="code-area" value={source} onChange={(e) => onSource(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {   // insert indentation; Esc then Tab leaves the editor
            e.preventDefault();
            const el = e.currentTarget, s = el.selectionStart, en = el.selectionEnd;
            onSource(source.slice(0, s) + "    " + source.slice(en));
            requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
          }
        }}
        className="min-h-[220px] flex-1 resize-none border-none bg-teal-900 p-4 font-mono text-sm leading-[1.6] text-cream-50 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron-400 md:min-h-[360px]" />
      <div className="flex flex-wrap items-center gap-2.5 border-t border-neutral-800 px-3.5 py-2.5">
        <button type="button" onClick={() => exec("compile")} disabled={disabled || busy}
          className="inline-flex h-11 items-center gap-2 rounded-[10px] border-[1.5px] border-teal-300 px-4 text-sm font-semibold text-cream-50 hover:bg-teal-800 disabled:opacity-50"><Icon name="code" size={18} />Compile</button>
        <button type="button" onClick={() => exec("run")} disabled={disabled || busy}
          className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-saffron-400 px-4 text-sm font-bold text-teal-900 hover:bg-saffron-300 disabled:opacity-60"><PlayIcon />Run</button>
        <span className="min-w-[160px] flex-1 text-[13px] text-teal-200">Explain your approach out loud while you type.</span>
      </div>
      <div role="status" aria-label="Output" aria-live="polite" className="flex min-h-24 flex-col gap-1.5 border-t border-neutral-800 bg-teal-950 px-3.5 py-3">
        <span className={cx("text-xs font-semibold uppercase tracking-[0.06em]")} style={{ color: labelColor }}>{label}</span>
        {lines.map((l, i) => <span key={i} className="break-words font-mono text-[13px] leading-normal" style={{ color: l.c }}>{l.t}</span>)}
      </div>
    </div>
  );
}
