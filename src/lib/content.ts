import type { Level, Round } from "@shared/config";

export interface RoundInfo {
  id: Round; name: string; desc: string; meta: string; why: string;
  companies: { n: string; d: string }[]; tips: string[];
}

/** Round copy from the design handoff (content spec). */
export const ROUND_INFO: Record<Round, RoundInfo> = {
  hr: {
    id: "hr", name: "HR Round", desc: "Introduce yourself, strengths, goals and situational questions.", meta: "Spoken answers",
    why: "Almost every campus drive ends with an HR round. It checks how clearly you talk about yourself, your goals and how you would fit in a team.",
    companies: [
      { n: "TCS", d: "HR round after the Technical and Managerial rounds, often on the same day." },
      { n: "Infosys", d: "HR interview after the online test and technical interview." },
      { n: "Accenture", d: "Usually a combined Technical plus HR interview of about 30 to 45 minutes." },
      { n: "Wipro", d: "HR round after the online assessment and technical interview." },
      { n: "Cognizant", d: "HR interview focused on communication and willingness to relocate." },
    ],
    tips: ["Prepare a 60 second introduction", "Use real examples, not general claims", "Know why you want this company", "Smile and keep a steady pace"],
  },
  tech: {
    id: "tech", name: "Technical Round", desc: "CS fundamentals: DSA concepts, OOP, DBMS, OS and networks.", meta: "Spoken, may include code",
    why: "Recruiters use the technical round to check that you understand the fundamentals behind your code and can explain them simply, not just recite definitions.",
    companies: [
      { n: "TCS", d: "Technical interview on your projects, one language, DBMS, OS and basic coding." },
      { n: "Infosys", d: "One technical interview for most fresher roles, two for specialist tracks." },
      { n: "Accenture", d: "OOP, exception handling, academic projects and code snippet questions." },
      { n: "Zoho", d: "Several technical rounds focused on problem solving and core concepts." },
      { n: "Amazon", d: "Technical interviews built around data structures and algorithms." },
    ],
    tips: ["Think out loud, interviewers value your reasoning", "Give one real example per concept", "Say \"I am not sure, but I think\" instead of guessing silently", "Keep each answer under 2 minutes"],
  },
  code: {
    id: "code", name: "Coding Round", desc: "Simple problems. Write code and explain your approach.", meta: "Code editor",
    why: "Product companies and many service companies test whether you can turn a problem into working code and explain the approach and its cost.",
    companies: [
      { n: "Amazon", d: "Online coding round, then technical interviews with DSA problems." },
      { n: "Zoho", d: "Basic and advanced programming rounds before the interviews." },
      { n: "TCS", d: "Coding in the NQT test and basic coding in the technical interview." },
      { n: "Accenture", d: "Coding assessment before the interview stage." },
    ],
    tips: ["Repeat the problem in your own words first", "Start with a simple solution, then improve it", "Talk about edge cases", "State the time complexity"],
  },
  mgr: {
    id: "mgr", name: "Managerial Round", desc: "Teamwork, conflict, decisions and your projects.", meta: "Spoken answers",
    why: "Managers want to see how you think about people, deadlines and trade-offs, and how you talk about the projects you built.",
    companies: [
      { n: "TCS", d: "Managerial round mostly for Digital and Prime roles: situations and teamwork." },
      { n: "Infosys", d: "Some drives add a managerial discussion after the technical round." },
      { n: "Accenture", d: "Some candidates report a managerial or client facing round." },
    ],
    tips: ["Pick two project stories to reuse", "Show what you did, not just the team", "Be honest about trade-offs", "Stay calm when challenged"],
  },
};

export const ROUND_ORDER: Round[] = ["hr", "tech", "code", "mgr"];

export const LEVEL_HINTS: Record<Level, string> = {
  Easy: "Common questions, friendly follow ups. Good for a first try.",
  Medium: "Typical campus interview level with some follow ups.",
  Hard: "Deeper follow ups and trickier questions, like product company rounds.",
};

export const DURATION_SUB: Record<5 | 10 | 15, string> = { 5: "About 3 questions", 10: "About 6 questions", 15: "About 9 questions" };

export const HOW_STEPS = [
  { n: "1", title: "Pick a round", text: "HR, Technical, Coding or Managerial. Choose Easy, Medium or Hard, and 5, 10 or 15 minutes." },
  { n: "2", title: "Check camera and mic", text: "Your camera shows only to you, like a real video interview. Nothing is recorded." },
  { n: "3", title: "Talk to the AI interviewer", text: "It asks questions out loud. Answer by speaking, write code when asked, skip if you need to." },
  { n: "4", title: "Get your feedback", text: "A compiled score, sub-scores, strengths, weaknesses and a stronger answer for each question." },
];

export const GENDERS = ["Prefer not to say", "Female", "Male", "Non-binary"] as const;
export const BRANCHES = ["CSE", "IT"] as const;
export const YEARS = ["3rd year", "4th year"] as const;
