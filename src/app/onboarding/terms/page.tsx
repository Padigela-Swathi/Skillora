import { redirect } from "next/navigation";
import { requireUser, profileComplete } from "@/lib/session";
import { TERMS_VERSION } from "@/lib/legal";
import { TermsClient } from "./TermsClient";

export const metadata = { title: "Terms and Privacy" };

export default async function TermsPage() {
  const { profile } = await requireUser();
  if (profile?.terms_version === TERMS_VERSION) redirect(profileComplete(profile) ? "/practice" : "/onboarding/details");
  return <TermsClient />;
}
