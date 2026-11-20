"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/lib/format";
import { initials, LogoMark } from "./Brand";
import { Icon } from "./Icon";

/** Public header (landing, sign in, terms, declined, details, generating): sticky cream header, 1200 max. */
export function PublicHeader({ landing = false }: { landing?: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-page">
      <div className="mx-auto flex max-w-[1296px] items-center justify-between gap-3 px-5 py-3.5 md:px-12">
        <Link href="/" aria-label="Skillora home" className="flex items-center gap-2.5">
          <LogoMark size={34} /><span className="text-[22px] font-bold tracking-tight text-ink">Skillora</span>
        </Link>
        {landing && (
          <div className="flex items-center gap-2">
            <a href="#how" className="hidden px-3.5 py-2.5 text-[15px] font-medium text-ink-2 md:inline">How it works</a>
            <a href="#rounds" className="hidden px-3.5 py-2.5 text-[15px] font-medium text-ink-2 md:inline">Rounds</a>
            <Link href="/signin" className="inline-flex h-11 items-center rounded-md border-[1.5px] border-teal-600 bg-white px-5 text-[15px] font-semibold text-teal-600 hover:bg-teal-50">Sign in</Link>
          </div>
        )}
      </div>
    </header>
  );
}

const NAV = [
  { href: "/practice", label: "Practice", icon: "mic" as const },
  { href: "/history", label: "History", icon: "history" as const },
  { href: "/settings", label: "Settings", icon: "sliders" as const },
];

/** App header (desktop nav pills + avatar) and the mobile bottom tab bar. Practice stays active on setup/tips/feedback screens. */
export function AppShell({ name, children }: { name: string; children: ReactNode }) {
  const path = usePathname();
  const active = (href: string) => (href === "/practice" ? path.startsWith("/practice") || path.startsWith("/feedback") : path.startsWith(href));
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-page">
        <div className="mx-auto flex max-w-[1296px] items-center justify-between gap-4 px-5 py-3 md:px-12">
          <Link href="/practice" aria-label="Skillora practice home" className="flex items-center gap-2.5">
            <LogoMark size={32} /><span className="text-xl font-bold text-ink">Skillora</span>
          </Link>
          <nav aria-label="Main" className="hidden gap-1.5 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
                className={cx("inline-flex h-11 items-center rounded-[10px] px-4 text-[15px] font-semibold", active(n.href) ? "bg-teal-100 text-teal-900" : "text-ink-2 hover:bg-neutral-100")}>{n.label}</Link>
            ))}
          </nav>
          <Link href="/settings" aria-label="Your profile" className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-[15px] font-bold text-white">{initials(name)}</Link>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <nav aria-label="Main" className="sticky bottom-0 z-10 grid grid-cols-3 border-t border-line bg-white md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
            className={cx("flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold", active(n.href) ? "text-teal-600" : "text-neutral-600")}>
            <Icon name={n.icon} size={22} />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
