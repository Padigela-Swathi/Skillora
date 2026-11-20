import { privacySections, TERMS_EFFECTIVE, TERMS_VERSION } from "@/lib/legal";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-[856px] flex-col gap-4 px-5 py-8 md:px-12">
      <h1 className="text-3xl font-bold md:text-[40px]">Privacy Policy</h1>
      <p className="text-[13px] text-ink-3">Last updated {TERMS_EFFECTIVE} · version {TERMS_VERSION}</p>
      {privacySections().map((s) => (<section key={s.h} className="flex flex-col gap-1"><h2 className="text-base font-semibold">{s.h}</h2><p className="text-[15px] leading-relaxed text-ink-2">{s.b}</p></section>))}
    </main>
  );
}
