import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Banner } from "@/components/ui";
import { reachStatsSchema } from "@/lib/admin";
import { requireReady } from "@/lib/session";
import { ReachDashboard } from "./ReachDashboard";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const { supabase } = await requireReady();
  // Non-admins get a plain 404, so the page's existence is not revealed. The SQL function re-checks admin rights itself.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();

  const { data, error } = await supabase.rpc("admin_reach_stats");
  const parsed = error ? null : reachStatsSchema.safeParse(data);
  if (!parsed?.success) {
    return (
      <main className="mx-auto flex max-w-[1200px] flex-col gap-[22px] px-5 pb-10 pt-7 md:px-12">
        <h1 className="text-[28px] font-bold md:text-[40px]">Admin</h1>
        <Banner tone="error">Could not load the reach numbers. {error ? "The database returned an error." : "The data was not in the expected shape."} Check that migration 20261125000005_admin_reach.sql is applied, then reload.</Banner>
      </main>
    );
  }
  return <ReachDashboard stats={parsed.data} />;
}
