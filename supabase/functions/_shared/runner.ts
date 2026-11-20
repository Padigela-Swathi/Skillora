// Code execution gateway. Providers: Judge0 CE (primary; public free instance or self-hosted via JUDGE0_URL) and Wandbox (fallback).
// Plain TS + fetch only, so it runs in Deno (Edge Functions) and Node (Vitest live tests).
import type { Language } from "./config.ts";

export type RunStatus = "ok" | "compile_error" | "runtime_error" | "timeout" | "internal_error";
export interface RunResult {
  status: RunStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  timeMs: number | null;
  provider: string;
}
export interface CompileResult { ok: boolean; output: string; provider: string }
export interface RunRequest { language: Language; source: string; stdin: string; timeLimitSec?: number }

export class RunnerError extends Error {
  constructor(message: string, public retryable = true) { super(message); }
}

export interface Runner {
  readonly name: string;
  run(req: RunRequest): Promise<RunResult>;
  compile(req: { language: Language; source: string }): Promise<CompileResult>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// ───────── helpers ─────────
export function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function fromB64(s: string | null | undefined): string {
  if (!s) return "";
  const bin = atob(s.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
const clip = (s: string, n = 4000) => (s.length > n ? s.slice(0, n) + "\n…(truncated)" : s);

/** Whitespace-tolerant comparison: trailing spaces per line and trailing blank lines are ignored. */
export function normalizeOutput(s: string): string {
  return s.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/g, "")).join("\n").replace(/\n+$/g, "");
}
export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

async function fetchWithTimeout(f: FetchLike, url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await f(url, { ...init, signal: ctrl.signal }); }
  catch (e) { throw new RunnerError(`network: ${(e as Error).name === "AbortError" ? "timeout" : (e as Error).message}`); }
  finally { clearTimeout(t); }
}

// ───────── Judge0 ─────────
const JUDGE0_IDS: Record<Language, number> = { python: 100, java: 91, cpp: 105, c: 103, javascript: 102 };

const PY_SYNTAX_HARNESS = `import sys
src = sys.stdin.read()
try:
    compile(src, "main.py", "exec")
except SyntaxError as e:
    print("SyntaxError: %s (line %s)" % (e.msg, e.lineno))
    sys.exit(1)
print("OK")
`;
const JS_SYNTAX_HARNESS = `const src = require("fs").readFileSync(0, "utf8");
try { new (require("vm").Script)(src, { filename: "main.js" }); console.log("OK"); }
catch (e) { console.log(String(e && e.stack ? e.stack : e).split("\\n").slice(0, 4).join("\\n")); process.exit(1); }
`;

export class Judge0Runner implements Runner {
  readonly name = "judge0";
  constructor(private baseUrl = "https://ce.judge0.com", private authToken?: string, private f: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async submit(body: Record<string, unknown>): Promise<Record<string, any>> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.authToken) headers["X-Auth-Token"] = this.authToken;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetchWithTimeout(this.f, `${this.baseUrl}/submissions?base64_encoded=true&wait=true`, {
        method: "POST", headers, body: JSON.stringify(body),
      }, 25000);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < 2) { await new Promise((r) => setTimeout(r, 600 * (attempt + 1))); continue; }
        throw new RunnerError(`judge0 http ${res.status}`);
      }
      if (!res.ok) throw new RunnerError(`judge0 http ${res.status}`, false);
      return await res.json();
    }
    throw new RunnerError("judge0 unavailable");
  }

  private map(d: Record<string, any>, ms: number | null): RunResult {
    const id: number = d.status?.id ?? 13;
    const status: RunStatus = id === 3 ? "ok" : id === 5 ? "timeout" : id === 6 ? "compile_error" : id === 13 || id === 14 ? "internal_error" : "runtime_error";
    return {
      status,
      stdout: clip(fromB64(d.stdout)),
      stderr: clip(fromB64(d.stderr) || (status === "timeout" ? "Time limit exceeded" : fromB64(d.message))),
      compileOutput: clip(fromB64(d.compile_output)),
      timeMs: d.time != null ? Math.round(Number(d.time) * 1000) : ms,
      provider: this.name,
    };
  }

  async run(req: RunRequest): Promise<RunResult> {
    const limit = Math.min(Math.max(req.timeLimitSec ?? 3, 1), 5);
    const d = await this.submit({
      language_id: JUDGE0_IDS[req.language],
      source_code: toB64(req.source),
      stdin: toB64(req.stdin),
      cpu_time_limit: limit,
      wall_time_limit: limit * 2,
      memory_limit: 256000,
    });
    const r = this.map(d, null);
    if (r.status === "internal_error") throw new RunnerError("judge0 internal error");
    return r;
  }

  async compile(req: { language: Language; source: string }): Promise<CompileResult> {
    if (req.language === "c" || req.language === "cpp") {
      const d = await this.submit({ language_id: JUDGE0_IDS[req.language], source_code: toB64(req.source), compiler_options: "-fsyntax-only", cpu_time_limit: 3, wall_time_limit: 6 });
      const r = this.map(d, null);
      if (r.status === "compile_error") return { ok: false, output: r.compileOutput, provider: this.name };
      return { ok: true, output: "", provider: this.name };
    }
    if (req.language === "python" || req.language === "javascript") {
      const harness = req.language === "python" ? PY_SYNTAX_HARNESS : JS_SYNTAX_HARNESS;
      const d = await this.submit({ language_id: JUDGE0_IDS[req.language], source_code: toB64(harness), stdin: toB64(req.source), cpu_time_limit: 3, wall_time_limit: 6 });
      const r = this.map(d, null);
      if (r.status === "internal_error") throw new RunnerError("judge0 internal error");
      return r.stdout.trim() === "OK" ? { ok: true, output: "", provider: this.name } : { ok: false, output: r.stdout.trim() || r.stderr, provider: this.name };
    }
    // java: javac cannot be run alone; compile + run once with empty stdin under a short limit.
    const r = await this.run({ language: "java", source: req.source, stdin: "", timeLimitSec: 2 });
    return r.status === "compile_error" ? { ok: false, output: r.compileOutput, provider: this.name } : { ok: true, output: "", provider: this.name };
  }
}

// ───────── Wandbox (fallback) ─────────
const WANDBOX: Record<Language, string> = {
  python: "cpython-3.12.7", java: "openjdk-jdk-21+35", cpp: "gcc-13.2.0", c: "gcc-13.2.0-c", javascript: "nodejs-20.17.0",
};

export class WandboxRunner implements Runner {
  readonly name = "wandbox";
  constructor(private baseUrl = "https://wandbox.org", private f: FetchLike = fetch) {}

  async run(req: RunRequest): Promise<RunResult> {
    const code = req.language === "java" ? req.source.replace(/public\s+class\s+Main/, "class Main") : req.source;
    const started = Date.now();
    let res: Response;
    try {
      // Wandbox has no per-run CPU limit parameter, so the client-side deadline doubles as the time limit.
      res = await fetchWithTimeout(this.f, `${this.baseUrl}/api/compile.json`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ compiler: WANDBOX[req.language], code, stdin: req.stdin }),
      }, 12000);
    } catch (e) {
      if (e instanceof RunnerError && e.message === "network: timeout") {
        return { status: "timeout", stdout: "", stderr: "Time limit exceeded", compileOutput: "", timeMs: Date.now() - started, provider: this.name };
      }
      throw e;
    }
    if (!res.ok) throw new RunnerError(`wandbox http ${res.status}`, res.status >= 500 || res.status === 429);
    const d = await res.json() as Record<string, string>;
    const compileErr = (d.compiler_error ?? "").trim();
    const exit = d.status ?? "0";
    let status: RunStatus = "ok";
    if (compileErr && exit !== "0" && !d.program_output && !d.program_error) status = "compile_error";
    else if (d.signal === "Killed" || /Killed|timed out/i.test(d.signal ?? "")) status = "timeout";
    else if (exit !== "0") status = "runtime_error";
    return {
      status, stdout: clip(d.program_output ?? ""), stderr: clip(d.program_error ?? ""),
      compileOutput: status === "compile_error" ? clip(compileErr) : "", timeMs: Date.now() - started, provider: this.name,
    };
  }

  async compile(req: { language: Language; source: string }): Promise<CompileResult> {
    const r = await this.run({ language: req.language, source: req.source, stdin: "" });
    if (r.status === "compile_error") return { ok: false, output: r.compileOutput, provider: this.name };
    if (r.status === "runtime_error" && (req.language === "python" || req.language === "javascript") && /SyntaxError/.test(r.stderr)) {
      return { ok: false, output: r.stderr, provider: this.name };
    }
    return { ok: true, output: "", provider: this.name };
  }
}

// ───────── composite: primary then fallback ─────────
export class FailoverRunner implements Runner {
  readonly name = "failover";
  constructor(private runners: Runner[]) {}
  private async each<T>(fn: (r: Runner) => Promise<T>): Promise<T> {
    let last: unknown;
    for (const r of this.runners) {
      try { return await fn(r); } catch (e) { last = e; }
    }
    throw new RunnerError(`all code runners unavailable: ${(last as Error)?.message ?? "unknown"}`);
  }
  run(req: RunRequest) { return this.each((r) => r.run(req)); }
  compile(req: { language: Language; source: string }) { return this.each((r) => r.compile(req)); }
}

export function defaultRunner(env: { JUDGE0_URL?: string; JUDGE0_AUTH_TOKEN?: string }, f: FetchLike = fetch): Runner {
  return new FailoverRunner([new Judge0Runner(env.JUDGE0_URL || "https://ce.judge0.com", env.JUDGE0_AUTH_TOKEN || undefined, f), new WandboxRunner("https://wandbox.org", f)]);
}

// ───────── test-case execution ─────────
export interface TestCase { input: string; expected: string; visible: boolean }
export interface TestOutcome {
  index: number; visible: boolean; passed: boolean; status: RunStatus;
  input?: string; expected?: string; actual?: string; error?: string; timeMs: number | null;
}

/** Hidden cases never include input/expected/actual in the outcome. */
export async function runTests(runner: Runner, language: Language, source: string, tests: TestCase[], concurrency = 3): Promise<{ outcomes: TestOutcome[]; provider: string }> {
  const outcomes: TestOutcome[] = new Array(tests.length);
  let provider = "";
  let next = 0;
  async function worker() {
    while (next < tests.length) {
      const i = next++;
      const t = tests[i];
      const r = await runner.run({ language, source, stdin: t.input });
      provider = r.provider;
      const passed = r.status === "ok" && outputsMatch(r.stdout, t.expected);
      outcomes[i] = {
        index: i, visible: t.visible, passed, status: r.status, timeMs: r.timeMs,
        ...(t.visible ? { input: t.input, expected: t.expected, actual: clip(r.stdout, 500) } : {}),
        ...(r.status !== "ok" ? { error: clip(r.compileOutput || r.stderr, 600) } : {}),
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tests.length) }, worker));
  return { outcomes, provider };
}
