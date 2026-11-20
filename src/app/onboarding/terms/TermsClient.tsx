"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Banner, Button } from "@/components/ui";
import { cx } from "@/lib/format";
import { privacySections, TERMS, TERMS_EFFECTIVE, TERMS_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/client";

export function TermsClient() {
  const router = useRouter();
  const [tab, setTab] = useState<"t" | "p">("t");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const sections = tab === "t" ? TERMS : privacySections();

  async function accept() {
    setBusy("accept"); setError(null);
    const { error } = await createClient().rpc("accept_terms", { p_version: TERMS_VERSION });
    if (error) { setError("We could not save your acceptance. Please try again."); setBusy(null); return; }
    router.push("/onboarding/details"); router.refresh();
  }
  async function decline() {
    setBusy("decline");
    await createClient().auth.signOut();   // product rule: declining signs the user out
    router.push("/signed-out"); router.refresh();
  }

  const tabBtn = (key: "t" | "p", label: string) => (
    <button type="button" role="tab" id={`${id}-tab-${key}`} aria-selected={tab === key} aria-controls={`${id}-panel`} tabIndex={tab === key ? 0 : -1}
      onClick={() => setTab(key)}
      onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); setTab(key === "t" ? "p" : "t"); document.getElementById(`${id}-tab-${key === "t" ? "p" : "t"}`)?.focus(); } }}
      className={cx("h-10 rounded-[9px] px-[18px] text-[15px] font-semibold", tab === key ? "bg-teal-600 text-white" : "text-teal-900 hover:bg-neutral-200")}>{label}</button>
  );

  return (
    <main className="mx-auto flex max-w-[856px] flex-col gap-5 px-5 pb-12 pt-8 md:px-12">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-teal-600">Step 1 of 2</span>
        <h1 className="text-[28px] font-bold md:text-[40px]">Before you start</h1>
        <p className="text-base leading-[1.55] text-ink-2">Please read and accept our Terms and Conditions and Privacy Policy to use Skillora.</p>
      </div>
      <div role="tablist" aria-label="Documents" className="inline-flex gap-1 self-start rounded-md bg-neutral-100 p-1">
        {tabBtn("t", "Terms and Conditions")}{tabBtn("p", "Privacy Policy")}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}
        className="flex h-[300px] flex-col gap-3.5 overflow-y-auto rounded-lg border border-line bg-white p-6">
        <span className="text-[13px] text-ink-3">Last updated {TERMS_EFFECTIVE} · version {TERMS_VERSION}</span>
        {sections.map((s) => (
          <div key={s.h} className="flex flex-col gap-1"><span className="text-base font-semibold">{s.h}</span><span className="text-[15px] leading-[1.6] text-ink-2">{s.b}</span></div>
        ))}
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-normal">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal-600" />
        <span>I have read and accept the Terms and Conditions and the Privacy Policy.</span>
      </label>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="flex flex-wrap-reverse justify-end gap-3">
        <Button variant="dangerOutline" onClick={decline} disabled={busy !== null} className="max-md:flex-[1_1_100%]">Decline</Button>
        <Button onClick={accept} disabled={!agree || busy !== null} className="max-md:flex-[1_1_100%]">{busy === "accept" ? "Saving…" : "Accept and continue"}</Button>
      </div>
    </main>
  );
}
