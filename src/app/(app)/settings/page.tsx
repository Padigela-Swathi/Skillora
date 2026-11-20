import { requireReady } from "@/lib/session";
import { SettingsView } from "./SettingsView";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile } = await requireReady();
  return <SettingsView userId={user.id} email={user.email ?? ""} profile={{ full_name: profile.full_name, college: profile.college, branch: profile.branch, year_of_study: profile.year_of_study, gender: profile.gender, age: profile.age }} />;
}
