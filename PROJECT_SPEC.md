# Skillora — Project Specification

Source inputs: `MVP_doc_version.docx` (Build Theory Fellowship MVP template, V1), `Skillora_Final_Design_Handoff.zip`
(`CLAUDE_CODE_HANDOFF.md` + final prototype canvas + tokens + assets), and the founder's written instructions
(NVIDIA API for AI; free code compiler; Supabase only; make everything work).

Authority order used: user instructions > MVP / handoff product rules > design (visual) > engineering practice.
Where the handoff's "agreed stack" mentions Cloudflare R2, it is superseded by the user's mandate that Supabase is the
sole backend platform (see DECISIONS D-02). No user file uploads exist in V1, so no object storage is required at all.

## 1. Overview
Skillora is an AI-powered mock-interview practice web app for 3rd/4th-year CSE and IT students. A student signs in with
Google, accepts the Terms/Privacy, fills a short profile, picks a round (HR / Technical / Coding / Managerial), a
difficulty and a duration, checks camera + mic, reads tips, then talks to an AI interviewer. Questions are AI-generated
(NVIDIA API). Answers are spoken (browser speech-to-text transcript) or, for coding questions, written in an editor that
can compile/run in 5 languages. The AI then scores the interview and returns strengths, weaknesses, tips and a stronger
answer per question. History tracks every interview.

## 2. Users / roles
| Role | Description | Capabilities |
|---|---|---|
| Student | Only role. Authenticated through Google (Supabase Auth). | Everything on their own data only. Optional admin (listed in `admins`) can view the aggregate reach dashboard at `/admin`; admins see no individual student data. |
| Anonymous | Not signed in. | Landing page, legal pages only. |

## 3. Requirements
Legend: M = mandatory, I = important, O = optional. All IDs are traced in `FEATURE_MATRIX.md`.

| ID | Pri | Requirement | Source |
|---|---|---|---|
| REQ-001 | M | Public website: landing page (hero, how it works, rounds, benefits, CTA, footer) | MVP §3.1 / handoff 01 |
| REQ-002 | M | Google sign-in/sign-up through Supabase Auth, session persistence, protected routes, sign out | MVP §4.1,4.12 / handoff 02, 13 |
| REQ-003 | M | View Terms & Privacy; Accept; Decline signs the user out; versioned re-acceptance when terms change | MVP §4.2 / handoff 03,04 |
| REQ-004 | M | Basic profile: name*, college*, branch* (CSE/IT), year* (3rd/4th), gender?, age?; editable in Settings | MVP §4.3 / handoff 05,15 |
| REQ-005 | M | Interview type selection with descriptions; difficulty Easy/Medium/Hard; duration 5/10/15 min → 3/6/9 questions | MVP §4.4 / handoff 06 |
| REQ-006 | M | Camera + mic permission, device pickers, self-view only (never recorded), live mic level meter | MVP §4.5 / handoff 07 |
| REQ-007 | M | Pre-interview tips: why this round, companies, tips, how it works | MVP §4.6 / handoff 08 |
| REQ-008 | M | AI question generation via **NVIDIA API**, tailored lightly to branch/year/level, coding questions mixed in | user + handoff §13 |
| REQ-009 | M | Interview room: real timer, progress, question card, Done / Skip / Quit(1 click), soft 2-min answer warning, time-up ends after current answer | MVP §4.7 / handoff 09 |
| REQ-010 | M | Voice answering with live transcript (speech-to-text, audio not stored); typed-answer fallback where the browser has no speech recognition | MVP §4.8 / handoff 09 |
| REQ-011 | M | Coding questions: editor, language select (Python, Java, C++, C, JavaScript), **Compile** and **Run** against tests via a **free** sandboxed executor | user + handoff §11.2 |
| REQ-012 | M | AI evaluation via NVIDIA: per-question score + went well / improve / stronger answer; sub-scores per round; compiled score = rounded mean of sub-scores; skipped excluded; needs ≥1 answer | MVP §4.9 / handoff 13 |
| REQ-013 | M | Feedback report screen incl. ended-early state and generating/progress screen | handoff 11,12,13 |
| REQ-014 | M | Retake same round / try another type | MVP §4.10 / handoff 13 |
| REQ-015 | M | History: overall performance, trend, average by round, filter by round, rows open the report | MVP §4.11 / handoff 14 |
| REQ-016 | M | Settings: edit profile, sign out, delete account (and all data) | handoff 15, §13 |
| REQ-017 | M | Usage limit: 3 interviews per day, enforced server-side, shown in UI | handoff §13 |
| REQ-018 | I | Feedback rating (1–5 + comment) after the 1st interview and then every 5th; stored in Supabase | handoff 13, §13 |
| REQ-019 | M | Per-user data isolation enforced by PostgreSQL RLS; hidden test cases never reach the browser | master prompt |
| REQ-020 | M | Responsive (desktop 1440 / mobile 390, fluid in between), WCAG-minded accessibility | handoff §3,§6 |
| REQ-021 | M | Netlify deployment preparation (config + docs); no deploy performed | master prompt |
| REQ-022 | M | **Zero recurring cost** for code execution and speech; AI cost limited to NVIDIA's API | user |
| REQ-023 | O | Storage buckets | none needed — see D-06 |

### Non-functional
- NFR-1 Security: RLS fail-closed on all tables; service-role key and NVIDIA key only in Supabase Edge Function secrets.
- NFR-2 Privacy: no audio/video stored; transcripts + feedback stored; account deletion removes everything.
- NFR-3 Resilience: AI/executor outages produce clear, retryable errors; no fake success.
- NFR-4 Performance: question generation < ~60 s; code run < ~15 s; page JS minimal.
- NFR-5 Accessibility: keyboard, labels, live regions, ≥44 px targets, contrast per design tokens, never colour-only state.

## 4. User journeys (see handoff flow map)
J1 Landing → Sign in (Google) → Terms (accept) → Details → Practice → Camera/mic → Tips → Interview → Generating → Feedback → Retry/Another/History.
J2 Terms decline → signed out screen → back/sign in again.
J3 Quit with ≥1 answer → Generating → Feedback (Ended early); Quit with 0 answers → Practice (interview discarded).
J4 History row → Feedback. J5 Settings: edit profile / sign out / delete account.
J6 Coding question: type code → Compile → Run → results → Done.

## 5. Business rules
- Roles: students only. Google sign-in only. Terms updates are made in code (`TERMS_VERSION`) and force re-acceptance.
- Branch CSE|IT, year 3rd|4th required; gender/age optional (age 15–60 sanity range). English only.
- Question count 3/6/9. Coding mix: Coding round ≈ two-thirds coding questions; Technical round 1–2 coding questions; HR/Managerial none (D-07).
- Answer soft limit 2:00 (warning only). Student presses Done (no silence detection). Skip excluded from score. Feedback requires ≥1 answer.
- Time up: current answer may finish, then the interview ends (feedback generated from answered questions).
- Score bands: 0–49 Needs work, 50–74 Getting there, 75–100 Interview ready.
- Compiled score = rounded mean of sub-scores. No confidence score.
- Daily limit 3 interviews, day boundary in Asia/Kolkata (D-08). Failed question generation does not consume the allowance; abandoned interviews with 0 answers do not either.
- Rating asked after 1st completed interview then every 5th (6th, 11th, …).
- Camera never recorded; audio not kept.

## 6. Data (summary — full detail in `DATABASE.md`)
`profiles`, `interviews`, `interview_questions`, `question_private` (hidden tests, no client access), `code_runs`, `feedback_ratings`.

## 7. Design references / assets
Design source of truth: handoff `design-source/prototype-canvas/Main.dc.html` > `design-system/tokens.*` > design-system boards.
Assets used from the ZIP (copied verbatim into `public/` and `src/assets/`): `assets/logos/skillora-icon.png`,
`assets/fonts/Inter-Variable.ttf` (+ `Inter-OFL.txt`, SIL OFL licence), the 19 SVG icons, `interviewer-avatar.svg`.
Screenshots in the ZIP are used as the visual comparison reference in Phase 4.
The ZIP's `runtime/` and `*.generated.js` are viewer-only and are **not** shipped (per handoff §1).

## 7b. Asset inventory (ZIP, 159 files)
logos (3 PNG), fonts (Inter variable TTF + OFL), icons (19 SVG), illustrations (3 SVG), tokens.json/tokens.css, 15 desktop + 15 mobile screens,
11×2 state screenshots, 7 design-system boards, prototype + design-system `.dc.html` sources. No other font licences are involved.
The ZIP contained no executable instructions beyond the handoff markdown (treated as a spec, not commands).

## 8. Constraints / non-goals
Non-goals: admin role, payments, non-CSE/IT branches, non-English, video/audio recording, 3D talking avatar (open question in handoff — 2D illustrated avatar placeholder is kept), email/password auth, native apps.

## 9. Assumptions (also in DECISIONS.md)
A1 Legal copy placeholders `[DATE]`/`[CONTACT EMAIL]` are replaced by config (`NEXT_PUBLIC_CONTACT_EMAIL`, a version date constant). The legal text itself is the founders' draft and needs legal review before launch.
A2 Speech-to-text uses the browser Web Speech API (Chrome/Edge best, as the design says "Use Chrome for the best voice results"). It is free but browser-dependent.
A3 Code execution uses public free Judge0 CE (primary) and Wandbox (fallback) through a Supabase Edge Function; self-hosting later is a config change.
A4 The interviewer's voice uses the browser's speechSynthesis (free).

## 10. Open questions (non-blocking)
Q1 Google OAuth client + redirect URLs must be created by the founders (cannot be done through the tools available).
Q2 NVIDIA API key must be added as the Supabase secret `NVIDIA_API_KEY` by the founders (value never passes through the AI client).
Q3 Final legal text/contact email. Q4 Production domain (for OAuth redirect + CORS allow-list).

## 11. Acceptance criteria (high level)
Each REQ has acceptance criteria and test evidence in `FEATURE_MATRIX.md`. Overall status is assigned in `HANDOFF.md`.
