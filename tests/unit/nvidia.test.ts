import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiError, chatJson, extractJson } from "../../supabase/functions/_shared/nvidia.ts";

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
});
