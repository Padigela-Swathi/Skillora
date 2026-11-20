import { AppShell } from "@/components/Shell";
import { requireReady } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireReady();
  return <AppShell name={profile.full_name}>{children}</AppShell>;
}
