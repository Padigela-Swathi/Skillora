"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { initials } from "@/components/Brand";
import { Banner, Button, Field, fieldClass, Segmented } from "@/components/ui";
import { BRANCHES, GENDERS, YEARS } from "@/lib/content";
import { validateProfile, type ProfileErrors } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";

export function DetailsForm({ userId, email, initial }: { userId: string; email: string; initial: { full_name: string; college: string; branch: string | null; year_of_study: string | null; gender: string | null; age: number | null } }) {
  const router = useRouter();
  const [name, setName] = useState(initial.full_name);
  const [college, setCollege] = useState(initial.college);
  const [branch, setBranch] = useState<string | null>(initial.branch);
  const [year, setYear] = useState<string | null>(initial.year_of_study);
  const [gender, setGender] = useState(initial.gender ?? "Prefer not to say");
  const [age, setAge] = useState(initial.age ? String(initial.age) : "");
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { errors, value } = validateProfile({ full_name: name, college, branch, year_of_study: year, gender, ageText: age });
    setErrors(errors); setFailure(null);
    if (!value) { document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(); return; }
    setSaving(true);
    const { error } = await createClient().from("profiles").update(value).eq("id", userId);
    if (error) { setFailure("We could not save your details. Please check them and try again."); setSaving(false); return; }
    router.push("/practice"); router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-[816px] flex-col gap-6 px-5 pb-12 pt-8 md:px-12">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-teal-600">Step 2 of 2</span>
        <h1 className="text-[28px] font-bold md:text-[40px]">Tell us a little about you</h1>
        <p className="text-base leading-[1.55] text-ink-2">This helps the AI pick questions that suit your branch and year. It takes 30 seconds.</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 rounded-lg border border-line bg-white p-5 md:p-8">
          <div className="flex items-center gap-3.5 border-b border-neutral-100 pb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 font-bold text-white" aria-hidden="true">{initials(name)}</span>
            <div className="flex min-w-0 flex-col gap-0.5"><span className="truncate text-base font-semibold">{name || "Your name"}</span><span className="truncate text-sm text-ink-3">{email} · from Google</span></div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex-[1_1_260px]"><Field label="Full name" error={errors.full_name}>{(p) => <input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} className={fieldClass(errors.full_name)} />}</Field></div>
            <div className="flex-[1_1_260px]"><Field label="College" error={errors.college}>{(p) => <input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={college} onChange={(e) => setCollege(e.target.value)} placeholder="Your college name" maxLength={150} className={fieldClass(errors.college)} />}</Field></div>
          </div>
          <div className="flex flex-wrap gap-5">
            <div className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">Branch <span className="text-brick-500" aria-hidden="true">*</span></span>
              <Segmented label="Branch" options={BRANCHES} value={(branch as (typeof BRANCHES)[number]) ?? null} onChange={setBranch} />
              {errors.branch && <span role="alert" className="text-[13px] font-medium text-brick-500">{errors.branch}</span>}</div>
            <div className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">Year of study <span className="text-brick-500" aria-hidden="true">*</span></span>
              <Segmented label="Year of study" options={YEARS} value={(year as (typeof YEARS)[number]) ?? null} onChange={setYear} />
              {errors.year_of_study && <span role="alert" className="text-[13px] font-medium text-brick-500">{errors.year_of_study}</span>}</div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex-[1_1_260px]"><Field label="Gender" optional>{(p) => <select id={p.id} value={gender} onChange={(e) => setGender(e.target.value)} className={fieldClass() + " px-3"}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select>}</Field></div>
            <div className="flex-[1_1_260px]"><Field label="Age" optional error={errors.age}>{(p) => <input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" placeholder="e.g. 21" maxLength={2} className={fieldClass(errors.age)} />}</Field></div>
          </div>
        </div>
        {failure && <Banner tone="error">{failure}</Banner>}
        <Button type="submit" disabled={saving} className="md:self-end max-md:w-full">{saving ? "Saving…" : "Continue to practice"}</Button>
      </form>
    </main>
  );
}
