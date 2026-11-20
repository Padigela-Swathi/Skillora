import { PublicHeader } from "@/components/Shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (<><PublicHeader />{children}</>);
}
