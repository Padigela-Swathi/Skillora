import { redirect } from "next/navigation";
import { requireUser, profileComplete } from "@/lib/session";
import { TERMS_VERSION } from "@/lib/legal";
import { DetailsForm } from "./DetailsForm";

export const metadata = { title: "Your details" };

export default async function DetailsPage() {
  const { user, profile } = await requireUser();
  if (profile?.terms_version !== TERMS_VERSION) redirect("/onboarding/terms");
  if (profileComplete(profile)) redirect("/practice");
  return <DetailsForm userId={user.id} email={user.email ?? ""} initial={{ full_name: profile?.full_name ?? "", college: profile?.college ?? "", branch: profile?.branch ?? null, year_of_study: profile?.year_of_study ?? null, gender: profile?.gender ?? null, age: profile?.age ?? null }} />;
}
