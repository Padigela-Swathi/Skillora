import Link from "next/link";
import { InterviewerAvatar } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { PublicHeader } from "@/components/Shell";
import { buttonClass } from "@/components/buttonStyles";
import { Overline } from "@/components/ui";
import { HOW_STEPS, ROUND_INFO, ROUND_ORDER } from "@/lib/content";

export default function Landing() {
  return (
    <>
      <PublicHeader landing />
      <main>
        <section className="mx-auto flex max-w-[1296px] flex-wrap items-center gap-12 px-5 py-10 md:px-12 md:py-20">
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
            <span className="self-start rounded-full bg-cream-200 px-3 py-1.5 text-[13px] font-semibold text-oxblood">AI mock interviews for CSE and IT students</span>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-[-0.02em] md:text-[60px]">Practise interviews. Walk in calm.</h1>
            <p className="text-[17px] leading-[1.55] text-ink-2 md:text-[19px]">Talk to an AI interviewer in HR, Technical, Coding and Managerial rounds. Get a score, your strengths, what to fix and a better answer for every question. No judgement, practise as often as you like.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signin" className={buttonClass("primary", "lg", "max-md:flex-1")}>Start practising free</Link>
              <a href="#how" className="inline-flex h-[52px] items-center rounded-md px-[22px] text-base font-semibold text-teal-600">See how it works</a>
            </div>
            <span className="text-sm text-ink-3">Sign in with Google · 3 practice interviews a day</span>
          </div>
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-3.5 rounded-xl bg-teal-800 p-5" aria-hidden="true">
            <div className="relative flex h-[220px] items-end justify-center overflow-hidden rounded-lg bg-teal-700 md:h-[300px]">
              <InterviewerAvatar width={200} height={230} />
              <span className="absolute left-3.5 top-3.5 rounded-full bg-saffron-400 px-2.5 py-[5px] text-xs font-semibold text-teal-900">06:42 left</span>
              <div className="absolute bottom-3.5 right-3.5 flex h-16 w-24 items-center justify-center rounded-[10px] border-2 border-teal-400 bg-teal-900 text-[11px] font-semibold text-teal-200">You</div>
            </div>
            <div className="flex flex-col gap-1.5 rounded-[14px] bg-page p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-teal-600">Question 3 of 6 · Technical</span>
              <span className="text-[17px] font-semibold leading-snug">What is the difference between a process and a thread?</span>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 border-y border-line bg-white">
          <div className="mx-auto flex max-w-[1296px] flex-col gap-8 px-5 py-10 md:px-12 md:py-20">
            <div className="flex flex-col gap-2"><Overline className="text-[13px]">How it works</Overline><h2 className="text-2xl font-bold md:text-[32px]">Four steps, about ten minutes</h2></div>
            <ol className="flex flex-wrap gap-4">
              {HOW_STEPS.map((s) => (
                <li key={s.n} className="flex flex-[1_1_230px] flex-col gap-2.5 rounded-lg border border-line bg-page p-[22px]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 font-bold text-white" aria-hidden="true">{s.n}</span>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-[15px] leading-[1.55] text-ink-3">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="rounds" className="mx-auto flex max-w-[1296px] scroll-mt-20 flex-col gap-8 px-5 py-10 md:px-12 md:py-20">
          <div className="flex flex-col gap-2"><Overline className="text-[13px]">Interview rounds</Overline><h2 className="text-2xl font-bold md:text-[32px]">Practise the rounds campus recruiters use</h2></div>
          <ul className="flex flex-wrap gap-4">
            {ROUND_ORDER.map((id) => (
              <li key={id} className="flex flex-[1_1_240px] flex-col gap-2.5 rounded-lg border border-line bg-white p-[22px]">
                <h3 className="text-lg font-semibold">{ROUND_INFO[id].name}</h3>
                <p className="text-[15px] leading-[1.55] text-ink-2">{ROUND_INFO[id].desc}</p>
                <span className="text-[13px] font-semibold text-teal-600">{ROUND_INFO[id].meta}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap gap-4">
            {[
              { icon: "user" as const, tone: "bg-teal-100 text-teal-600", t: "Judgement free", d: "Nobody is watching. Make mistakes here, not in the real room." },
              { icon: "bulb" as const, tone: "bg-saffron-100 text-saffron-700", t: "Feedback you can use", d: "Sub-scores for every round, plus a stronger answer to learn from." },
              { icon: "chart" as const, tone: "bg-cream-200 text-oxblood", t: "See yourself improve", d: "Every interview is saved with a score trend over time." },
            ].map((b) => (
              <li key={b.t} className="flex flex-[1_1_300px] items-start gap-3.5">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${b.tone}`}><Icon name={b.icon} size={22} /></span>
                <div className="flex flex-col gap-1"><span className="text-[17px] font-semibold">{b.t}</span><span className="text-[15px] leading-normal text-ink-3">{b.d}</span></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-[1296px] px-5 pb-10 md:px-12 md:pb-20">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-teal-600 p-6 text-white md:p-10">
            <div className="flex flex-[1_1_360px] flex-col gap-2">
              <h2 className="text-2xl font-bold md:text-[32px]">Your next interview starts with practice</h2>
              <p className="text-base leading-normal text-teal-100">Free for students. All you need is a laptop or phone with a camera and mic.</p>
            </div>
            <Link href="/signin" className={buttonClass("accent", "lg", "max-md:w-full")}>Start practising</Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1296px] flex-wrap justify-between gap-4 px-5 py-6 text-sm text-ink-3 md:px-12">
          <span>© 2026 Skillora. Practice with Confidence. Interview with Success.</span>
          <nav aria-label="Legal" className="flex gap-5"><Link href="/legal/terms" className="text-teal-600 underline">Terms</Link><Link href="/legal/privacy" className="text-teal-600 underline">Privacy</Link></nav>
        </div>
      </footer>
    </>
  );
}
