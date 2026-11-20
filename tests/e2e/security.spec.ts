import { expect, test } from "@playwright/test";
import { IDS, sessionCookies, USERS } from "./helpers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const H = (jwt?: string) => ({ apikey: ANON, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), "content-type": "application/json" });

async function jwtFor(who: "a" | "b", baseURL: string) {
  const c = (await sessionCookies(USERS[who], baseURL)).map((x) => x.value).join("");
  const json = JSON.parse(Buffer.from(c.replace(/^base64-/, ""), "base64url").toString());
  return json.access_token as string;
}

test("direct API access: anonymous and other users cannot read or write interview data", async ({ request, baseURL }) => {
  const a = await jwtFor("a", baseURL!), b = await jwtFor("b", baseURL!);
  // anonymous
  for (const t of ["profiles", "interviews", "interview_questions", "question_private", "code_runs", "feedback_ratings"]) {
    const r = await request.get(`${URL}/rest/v1/${t}?select=*`, { headers: H() });
    expect(r.status(), `anon read ${t}`).toBe(401);
  }
  // user A reading B's rows gets nothing; hidden tests are never readable by anyone signed in
  const mine = await request.get(`${URL}/rest/v1/interviews?select=id`, { headers: H(a) });
  expect((await mine.json()).some((r: { id: string }) => r.id === IDS.live)).toBe(false);
  const peek = await request.get(`${URL}/rest/v1/interview_questions?id=eq.${IDS.codingQ}&select=*`, { headers: H(a) });
  expect(await peek.json()).toEqual([]);
  const priv = await request.get(`${URL}/rest/v1/question_private?select=*`, { headers: H(b) });
  expect(priv.status()).toBe(403);
  // writes are denied even for the owner
  const w1 = await request.patch(`${URL}/rest/v1/interviews?id=eq.${IDS.done}`, { headers: H(b), data: { score: 100 } });
  expect(w1.status()).toBe(403);
  const w2 = await request.patch(`${URL}/rest/v1/interview_questions?id=eq.${IDS.codingQ}`, { headers: H(b), data: { score: 100 } });
  expect(w2.status()).toBe(403);
  const w3 = await request.post(`${URL}/rest/v1/interviews`, { headers: H(b), data: { user_id: USERS.b.email, round: "hr", level: "Easy", duration_min: 5, question_count: 3 } });
  expect(w3.status()).toBe(403);
  const w4 = await request.patch(`${URL}/rest/v1/profiles?id=neq.00000000-0000-0000-0000-000000000000`, { headers: H(b), data: { terms_version: "2099-01-01" } });
  expect(w4.status()).toBe(403);
  // RPCs enforce ownership
  const fin = await request.post(`${URL}/rest/v1/rpc/finish_interview`, { headers: H(a), data: { p_interview_id: IDS.live, p_quit: true } });
  expect(fin.status()).toBeGreaterThanOrEqual(400);
  expect(await fin.text()).toContain("NOT_FOUND");
});

test("Edge Functions reject missing/invalid tokens and cross-user access", async ({ request, baseURL }) => {
  const a = await jwtFor("a", baseURL!);
  for (const fn of ["start-interview", "run-code", "evaluate-interview", "delete-account"]) {
    expect((await request.post(`${URL}/functions/v1/${fn}`, { headers: { "content-type": "application/json" }, data: {} })).status(), `${fn} no auth`).toBe(401);
    const forged = await request.post(`${URL}/functions/v1/${fn}`, { headers: H("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad"), data: {} });
    expect(forged.status(), `${fn} forged jwt`).toBe(401);
  }
  const run = await request.post(`${URL}/functions/v1/run-code`, { headers: H(a), data: { question_id: IDS.codingQ, language: "python", mode: "run", source: "print(1)" } });
  expect(run.status()).toBe(404);   // B's question is invisible to A
  const ev = await request.post(`${URL}/functions/v1/evaluate-interview`, { headers: H(a), data: { interview_id: IDS.done } });
  expect(ev.status()).toBe(404);
  const bad = await request.post(`${URL}/functions/v1/run-code`, { headers: H(a), data: { question_id: "not-a-uuid", language: "cobol", mode: "run", source: "" } });
  expect(bad.status()).toBe(400);
});
