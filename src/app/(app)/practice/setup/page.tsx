import { redirect } from "next/navigation";
import { parseSelection, selectionQuery } from "@/lib/params";
import { DeviceCheck } from "./DeviceCheck";

export const metadata = { title: "Check camera and mic" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ round?: string; level?: string; dur?: string }> }) {
  const sel = parseSelection(await searchParams);
  if (!sel) redirect("/practice");
  const q = selectionQuery(sel);
  return <DeviceCheck backHref={`/practice?${q}`} nextHref={`/practice/tips?${q}`} />;
}
