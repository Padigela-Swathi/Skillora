import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AiError, chatJson, extractJson, resetModelHealth } from "../../supabase/functions/_shared/nvidia.ts";

const schema = z.object({ ok: z.boolean(), n: z.number() });
const reply = (content: string | null, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { choices: [{ message: { content } }] } : { error: "x" }), { status });

function fakeFetch(responses: (Response | Error)[]) {
  const calls: { body: { model: string; response_format?: unknown; messages: { content: string }[] } }[] = [];
  const f = async (_url: string, init?: RequestInit) => {
    calls.push({ body: JSON.parse(String(init?.body)) });
    const r = responses.shift();
    if (!r) throw new Error("unexpected extra call");
    if (r instanceof Error) throw r;
    return r;
  };
  return { f, calls };
}
const req = { system: "s", user: "u", schema };

describe("extractJson", () => {
  it("parses plain JSON, fenced JSON and JSON surrounded by chatter", () => {
    expect(extractJson('{"ok":true,"n":1}')).toEqual({ ok: true, n: 1 });
    expect(extractJson('```json\n{"ok":true,"n":2}\n```')).toEqual({ ok: true, n: 2 });
    expect(extractJson('Sure! Here you go: {"ok":true,"n":3} hope it helps')).toEqual({ ok: true, n: 3 });
  });
  it("throws when there is no JSON", () => { expect(() => extractJson("nothing here")).toThrow(); });
});

describe("chatJson", () => {
  beforeEach(() => resetModelHealth());
  it("refuses to run without an API key", async () => {
    await expect(chatJson({}, req)).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  });
  it("returns validated data and sends the key and JSON mode", async () => {
    const { f, calls } = fakeFetch([reply('{"ok":true,"n":5}')]);
    const out = await chatJson({ apiKey: "k", fetch: f }, req);
    expect(out).toEqual({ ok: true, n: 5 });
    expect(calls[0].body.response_format).toEqual({ type: "json_object" });
    expect(calls[0].body.model).toBe("google/gemma-4-31b-it");
  });
  it("repairs once when the first reply fails schema validation", async () => {
    const { f, calls } = fakeFetch([reply('{"ok":"yes"}'), reply('{"ok":true,"n":1}')]);
    expect(await chatJson({ apiKey: "k", fetch: f }, req)).toEqual({ ok: true, n: 1 });
    expect(calls[1].body.messages.at(-1)!.content).toContain("invalid");
  });
  it("falls back to the secondary model when the primary is end-of-life (410)", async () => {
    const { f, calls } = fakeFetch([reply(null, 410), reply('{"ok":true,"n":9}')]);
    expect(await chatJson({ apiKey: "k", model: "old/model", fallbackModel: "new/model", fetch: f }, req)).toEqual({ ok: true, n: 9 });
    expect(calls[1].body.model).toBe("new/model");
  });
  it("retries without JSON mode when the model rejects it (400)", async () => {
    const { f, calls } = fakeFetch([reply(null, 400), reply('{"ok":true,"n":4}')]);
    await chatJson({ apiKey: "k", fetch: f }, req);
    expect(calls[1].body.response_format).toBeUndefined();
  });
  it("maps an invalid key to AI_NOT_CONFIGURED", async () => {
    const { f } = fakeFetch([reply(null, 401)]);
    await expect(chatJson({ apiKey: "bad", fetch: f }, req)).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  });
  it("reports AI_UNAVAILABLE when every attempt fails with 5xx", async () => {
    const { f } = fakeFetch(Array.from({ length: 30 }, () => reply(null, 503)));
    const e = await chatJson({ apiKey: "k", fetch: f }, req).catch((x) => x);
    expect(e).toBeInstanceOf(AiError); expect(e.code).toBe("AI_UNAVAILABLE");
  }, 30000);
  it("reports AI_BAD_OUTPUT when replies never validate", async () => {
    const { f } = fakeFetch(Array.from({ length: 30 }, () => reply("not json")));
    await expect(chatJson({ apiKey: "k", fetch: f }, req)).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
  });
  it("treats empty content (reasoning-only models) as bad output, not success", async () => {
    const { f } = fakeFetch(Array.from({ length: 30 }, () => reply(null)));
    await expect(chatJson({ apiKey: "k", fetch: f }, req)).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
  });
  it("stops retrying when the total time budget is spent (Edge Function limit)", async () => {
    const { f, calls } = fakeFetch(Array.from({ length: 30 }, () => reply(null, 503)));
    const e = await chatJson({ apiKey: "k", fetch: f, deadlineMs: 3000 }, req).catch((x) => x);
    expect(e.code).toBe("AI_UNAVAILABLE");
    expect(calls.length).toBeLessThan(3);   // would be 9 (3 models x 3 attempts) without the budget
  }, 20000);

  // A model that accepts the request but never answers (seen live: google/gemma-4-31b-it stalled for 90 s+).
  const stallThenOk = (stalled: string, ok: string) => {
    const calls: string[] = [];
    const f = (_url: string, init?: RequestInit) => {
      const model = JSON.parse(String(init?.body)).model as string;
      calls.push(model);
      if (model === stalled) {
        return new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
        });
      }
      return Promise.resolve(model === ok ? reply('{"ok":true,"n":7}') : reply(null, 410));
    };
    return { f, calls };
  };
  it("moves to the next model immediately when the primary stalls (no retry of the stalled model)", async () => {
    const { f, calls } = stallThenOk("slow/primary", "fast/fallback");
    const t0 = Date.now();
    const out = await chatJson({ apiKey: "k", model: "slow/primary", fallbackModel: "fast/fallback", timeoutMs: 80, fetch: f }, req);
    expect(out).toEqual({ ok: true, n: 7 });
    expect(calls).toEqual(["slow/primary", "fast/fallback"]);
    expect(Date.now() - t0).toBeLessThan(1500);
  });
  it("remembers a stalled model so the next call starts with the fast one", async () => {
    const { f, calls } = stallThenOk("slow/primary", "fast/fallback");
    const cfg = { apiKey: "k", model: "slow/primary", fallbackModel: "fast/fallback", timeoutMs: 80, fetch: f };
    await chatJson(cfg, req);
    calls.length = 0;
    await chatJson(cfg, req);
    expect(calls).toEqual(["fast/fallback"]);
  });
  it("still leaves time for the fallback after a stalled primary (default per-call timeout is well under the budget)", async () => {
    const { f, calls } = stallThenOk("slow/primary", "fast/fallback");
    // primary may use at most timeoutMs; the fallback gets the rest of the 1 s budget
    const out = await chatJson({ apiKey: "k", model: "slow/primary", fallbackModel: "fast/fallback", timeoutMs: 300, deadlineMs: 5000, fetch: f }, req);
    expect(out.n).toBe(7);
    expect(calls.at(-1)).toBe("fast/fallback");
  });
});
