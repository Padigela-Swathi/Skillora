"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Banner, Button, Dialog, Field, fieldClass, Segmented } from "@/components/ui";
import { ApiCallError, invokeFn } from "@/lib/api";
import { BRANCHES, GENDERS, YEARS } from "@/lib/content";
import { validateProfile, type ProfileErrors } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";
import { DAILY_LIMIT } from "@shared/config";

export function SettingsView({ userId, email, profile }: { userId: string; email: string; profile: { full_name: string; college: string; branch: string | null; year_of_study: string | null; gender: string | null; age: number | null } }) {
  const router = useRouter();
  const [name, setName] = useState(profile.full_name);
  const [college, setCollege] = useState(profile.college);
  const [branch, setBranch] = useState<string | null>(profile.branch);
  const [year, setYear] = useState<string | null>(profile.year_of_study);
  const [gender, setGender] = useState(profile.gender ?? "Prefer not to say");
  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaved(false); setFailure(null);
    const { errors, value } = validateProfile({ full_name: name, college, branch, year_of_study: year, gender, ageText: age });
    setErrors(errors);
    if (!value) return;
    setSaving(true);
    const { error } = await createClient().from("profiles").update(value).eq("id", userId);
    setSaving(false);
    if (error) { setFailure("We could not save your changes. Please try again."); return; }
    setSaved(true); router.refresh();
  }
  async function signOut() { await createClient().auth.signOut(); router.push("/"); router.refresh(); }
  async function deleteAccount() {
    setDeleting(true); setDelErr(null);
    try {
      await invokeFn("delete-account", { confirm: "DELETE" });
      await createClient().auth.signOut({ scope: "local" }).catch(() => {});
      router.push("/"); router.refresh();
    } catch (e) { setDelErr(e instanceof ApiCallError ? e.message : "Something went wrong. Please try again."); setDeleting(false); }
  }
  const dirty = () => setSaved(false);

  return (
    <main className="mx-auto flex max-w-[820px] flex-col gap-[22px] px-5 pb-10 pt-7 md:px-12">
      <h1 className="text-[28px] font-bold md:text-[40px]">Settings</h1>
      <form onSubmit={save} noValidate className="flex flex-col gap-[18px] rounded-lg border border-line bg-white p-5 md:p-8">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex-[1_1_240px]"><Field label="Full name" error={errors.full_name}>{(p) => <input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={name} onChange={(e) => { setName(e.target.value); dirty(); }} maxLength={100} className={fieldClass(errors.full_name)} />}</Field></div>
          <div className="flex-[1_1_240px]"><Field label="College" error={errors.college}>{(p) => <input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={college} onChange={(e) => { setCollege(e.target.value); dirty(); }} maxLength={150} className={fieldClass(errors.college)} />}</Field></div>
        </div>
        <div className="flex flex-wrap gap-5">
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">Branch</span><Segmented label="Branch" options={BRANCHES} value={(branch as (typeof BRANCHES)[number]) ?? null} onChange={(v) => { setBranch(v); dirty(); }} /></div>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">Year</span><Segmented label="Year" options={YEARS} value={(year as (typeof YEARS)[number]) ?? null} onChange={(v) => { setYear(v); dirty(); }} /></div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex-[1_1_240px]"><Field label="Gender" optional>{(p) => <select id={p.id} value={gender} onChange={(e) => { setGender(e.target.value); dirty(); }} className={fieldClass() + " px-3"}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select>}</Field></div>
          <div className="flex-[1_1_240px]"><Field label="Age" optional error={errors.age}>{(p) => <input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={age} onChange={(e) => { setAge(e.target.value); dirty(); }} inputMode="numeric" maxLength={2} className={fieldClass(errors.age)} />}</Field></div>
        </div>
        {failure && <Banner tone="error">{failure}</Banner>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="md" disabled={saving} className="max-md:flex-[1_1_100%]">{saving ? "Saving…" : "Save changes"}</Button>
          {saved && <span role="status" className="text-sm font-semibold text-teal-600">Saved</span>}
        </div>
      </form>

      <section className="flex flex-col gap-1 rounded-lg border border-line bg-white p-5 md:p-8" aria-labelledby="acct">
        <h2 id="acct" className="mb-2 text-lg font-semibold">Account</h2>
        <div className="flex items-center justify-between gap-2.5 border-b border-neutral-100 py-3 text-[15px]"><span>Google account</span><span className="truncate text-ink-3">{email}</span></div>
        <div className="flex items-center justify-between gap-2.5 border-b border-neutral-100 py-3 text-[15px]"><span>Daily limit</span><span className="text-ink-3">{DAILY_LIMIT} interviews a day</span></div>
        <div className="flex items-center justify-between gap-2.5 border-b border-neutral-100 py-3 text-[15px]"><span>Legal</span><span className="flex gap-3.5"><Link href="/legal/terms" className="text-teal-600 underline">Terms</Link><Link href="/legal/privacy" className="text-teal-600 underline">Privacy</Link></span></div>
        <div className="flex flex-wrap gap-3 pt-3.5">
          <Button variant="secondary" size="md" onClick={signOut} className="max-md:flex-[1_1_100%]"><Icon name="signOut" size={18} />Sign out</Button>
          <Button variant="dangerSoft" size="md" onClick={() => { setDelErr(null); setDelOpen(true); }} className="max-md:flex-[1_1_100%]">Delete my account</Button>
        </div>
      </section>

      <Dialog open={delOpen} onClose={() => !deleting && setDelOpen(false)} title="Delete your account?"
        actions={<>
          <Button variant="secondary" size="md" onClick={() => setDelOpen(false)} disabled={deleting} className="flex-[1_1_140px]">Cancel</Button>
          <Button variant="danger" size="md" onClick={deleteAccount} disabled={deleting} className="flex-[1_1_140px]">{deleting ? "Deleting…" : "Delete account"}</Button>
        </>}>
        <p>This permanently deletes your profile, every interview, transcript, score and piece of feedback. It cannot be undone.</p>
        {delErr && <Banner tone="error" className="mt-3">{delErr}</Banner>}
      </Dialog>
    </main>
  );
}
