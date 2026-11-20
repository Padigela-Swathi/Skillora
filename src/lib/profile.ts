import { BRANCHES, GENDERS, YEARS } from "@/lib/content";

export interface ProfileInput { full_name: string; college: string; branch: string | null; year_of_study: string | null; gender: string | null; age: number | null }
export type ProfileErrors = Partial<Record<"full_name" | "college" | "branch" | "year_of_study" | "age", string>>;

/** Client-side validation mirroring the database constraints (the DB remains the authority). */
export function validateProfile(input: { full_name: string; college: string; branch: string | null; year_of_study: string | null; gender: string | null; ageText: string }):
  { errors: ProfileErrors; value: ProfileInput | null } {
  const errors: ProfileErrors = {};
  const full_name = input.full_name.trim(), college = input.college.trim();
  if (!full_name) errors.full_name = "Enter your full name."; else if (full_name.length > 100) errors.full_name = "Use 100 characters or fewer.";
  if (!college) errors.college = "Enter your college name."; else if (college.length > 150) errors.college = "Use 150 characters or fewer.";
  if (!input.branch || !(BRANCHES as readonly string[]).includes(input.branch)) errors.branch = "Choose your branch.";
  if (!input.year_of_study || !(YEARS as readonly string[]).includes(input.year_of_study)) errors.year_of_study = "Choose your year of study.";
  let age: number | null = null;
  const t = input.ageText.trim();
  if (t) {
    if (!/^\d{1,2}$/.test(t) || Number(t) < 15 || Number(t) > 60) errors.age = "Enter an age between 15 and 60, or leave it empty.";
    else age = Number(t);
  }
  const gender = input.gender && (GENDERS as readonly string[]).includes(input.gender) ? input.gender : null;
  if (Object.keys(errors).length) return { errors, value: null };
  return { errors, value: { full_name, college, branch: input.branch, year_of_study: input.year_of_study, gender, age } };
}
