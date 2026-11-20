import { describe, expect, it } from "vitest";
import { FailoverRunner, fromB64, Judge0Runner, normalizeOutput, outputsMatch, RunnerError, runTests, toB64, WandboxRunner, type Runner } from "../../supabase/functions/_shared/runner.ts";

const j0 = (statusId: number, extra: Record<string, string | null> = {}) =>
  new Response(JSON.stringify({ status: { id: statusId }, stdout: null, stderr: null, compile_output: null, message: null, time: "0.01", ...extra }), { status: 200 });

describe("helpers", () => {
  it("base64 round-trips UTF-8", () => { expect(fromB64(toB64("héllo → 世界\n"))).toBe("héllo → 世界\n"); });
  it("output comparison ignores trailing whitespace and CRLF only", () => {
    expect(outputsMatch("1 2 \r\n3\n\n", "1 2\n3")).toBe(true);
    expect(outputsMatch("1 2", "1  2")).toBe(false);
    expect(normalizeOutput("a\n\n\n")).toBe("a");
  });
});

describe("Judge0Runner", () => {
  it("maps accepted / compile error / timeout / runtime error", async () => {
    const seq = [j0(3, { stdout: toB64("42\n") }), j0(6, { compile_output: toB64("error: boom") }), j0(5), j0(11, { stderr: toB64("Traceback") })];
    const r = new Judge0Runner("https://x", undefined, async () => seq.shift()!);
    const a = await r.run({ language: "python", source: "print(42)", stdin: "" });
    expect(a).toMatchObject({ status: "ok", stdout: "42\n" });
    expect((await r.run({ language: "c", source: "x", stdin: "" })).status).toBe("compile_error");
    expect((await r.run({ language: "python", source: "x", stdin: "" })).status).toBe("timeout");
    expect((await r.run({ language: "python", source: "x", stdin: "" })).status).toBe("runtime_error");
  });
  it("sends language ids, base64 payload, limits and the auth token", async () => {
    let seen: Record<string, unknown> = {}; let url = ""; let headers: Record<string, string> = {};
    const r = new Judge0Runner("https://judge.example/", "tok", async (u, init) => { url = u; headers = init!.headers as Record<string, string>; seen = JSON.parse(String(init!.body)); return j0(3); });
    await r.run({ language: "java", source: "class Main{}", stdin: "5" });
    expect(url).toBe("https://judge.example/submissions?base64_encoded=true&wait=true");
    expect(seen.language_id).toBe(91); expect(fromB64(seen.stdin as string)).toBe("5"); expect(seen.cpu_time_limit as number).toBeLessThanOrEqual(5);
    expect(headers["X-Auth-Token"]).toBe("tok");
  });
  it("compile(): C uses -fsyntax-only and treats a missing binary as success", async () => {
    let body: Record<string, unknown> = {};
    const r = new Judge0Runner("https://x", undefined, async (_u, init) => { body = JSON.parse(String(init!.body)); return j0(11, { stderr: toB64("No such file") }); });
    expect(await r.compile({ language: "c", source: "int main(){}" })).toMatchObject({ ok: true });
    expect(body.compiler_options).toBe("-fsyntax-only");
  });
  it("compile(): reports compiler output on error and uses a harness for Python", async () => {
    const r1 = new Judge0Runner("https://x", undefined, async () => j0(6, { compile_output: toB64("main.c:1: error") }));
    expect(await r1.compile({ language: "cpp", source: "x" })).toEqual({ ok: false, output: "main.c:1: error", provider: "judge0" });
    let body: Record<string, unknown> = {};
    const r2 = new Judge0Runner("https://x", undefined, async (_u, init) => { body = JSON.parse(String(init!.body)); return j0(3, { stdout: toB64("SyntaxError: invalid syntax (line 1)\n") }); });
    const c = await r2.compile({ language: "python", source: "def (" });
    expect(c.ok).toBe(false); expect(fromB64(body.stdin as string)).toBe("def (");
  });
  it("retries a dropped connection quickly instead of failing over", async () => {
    let n = 0;
    const r = new Judge0Runner("https://x", undefined, async () => { if (n++ === 0) throw new TypeError("fetch failed"); return j0(3, { stdout: toB64("ok\n") }); });
    expect((await r.run({ language: "python", source: "print('ok')", stdin: "" })).stdout).toBe("ok\n");
    expect(n).toBe(2);
  });
  it("retries on 429 then throws a retryable RunnerError", async () => {
    let n = 0;
    const r = new Judge0Runner("https://x", undefined, async () => { n++; return new Response("busy", { status: 429 }); });
    await expect(r.run({ language: "python", source: "x", stdin: "" })).rejects.toBeInstanceOf(RunnerError);
    expect(n).toBe(3);
  }, 15000);
});

describe("FailoverRunner / Wandbox", () => {
  it("falls back to Wandbox when Judge0 is down", async () => {
    const down: Runner = { name: "down", run: async () => { throw new RunnerError("503"); }, compile: async () => { throw new RunnerError("503"); } };
    const wb = new WandboxRunner("https://w", async () => new Response(JSON.stringify({ status: "0", program_output: "7\n", program_error: "", compiler_error: "" })));
    const r = await new FailoverRunner([down, wb]).run({ language: "python", source: "print(7)", stdin: "" });
    expect(r).toMatchObject({ status: "ok", stdout: "7\n", provider: "wandbox" });
  });
  it("throws when every provider is down", async () => {
    const down: Runner = { name: "down", run: async () => { throw new RunnerError("x"); }, compile: async () => { throw new RunnerError("x"); } };
    await expect(new FailoverRunner([down, down]).run({ language: "c", source: "", stdin: "" })).rejects.toBeInstanceOf(RunnerError);
  });
  it("Wandbox: strips `public` from class Main for Java and maps compile errors", async () => {
    let sent: Record<string, unknown> = {};
    const wb = new WandboxRunner("https://w", async (_u, init) => { sent = JSON.parse(String(init!.body)); return new Response(JSON.stringify({ status: "1", compiler_error: "prog.java:1: error", program_output: "", program_error: "" })); });
    const r = await wb.run({ language: "java", source: "public class Main {}", stdin: "" });
    expect(sent.code).toBe("class Main {}"); expect(r.status).toBe("compile_error");
  });
});

describe("runTests", () => {
  const fake: Runner = {
    name: "fake",
    run: async (q) => ({ status: "ok", stdout: String(Number(q.stdin) * 2) + "\n", stderr: "", compileOutput: "", timeMs: 5, provider: "fake" }),
    compile: async () => ({ ok: true, output: "", provider: "fake" }),
  };
  it("judges each case and NEVER leaks hidden inputs/expected outputs", async () => {
    const { outcomes } = await runTests(fake, "python", "x", [
      { input: "2", expected: "4", visible: true }, { input: "3", expected: "6", visible: false }, { input: "4", expected: "9", visible: false },
    ]);
    expect(outcomes.map((o) => o.passed)).toEqual([true, true, false]);
    expect(outcomes[0]).toMatchObject({ input: "2", expected: "4", actual: "4\n" });
    for (const o of outcomes.slice(1)) { expect(o.input).toBeUndefined(); expect(o.expected).toBeUndefined(); expect(o.actual).toBeUndefined(); }
  });
});
