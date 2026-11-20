"use client";
import Link from "next/link";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./buttonStyles";

/* ───────── Buttons (styles live in ./buttonStyles so server components can use them) ───────── */
export function Button({ variant = "primary", size = "lg", className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function LinkButton({ href, variant = "primary", size = "lg", className, children, ...rest }: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return <Link href={href} className={buttonClass(variant, size, className)} {...rest}>{children}</Link>;
}

/* ───────── Segmented control (role=radiogroup, arrow-key navigation) ───────── */
export function Segmented<T extends string | number>({ options, value, onChange, label, size = "md", full = false, labelOf }: {
  options: readonly T[]; value: T | null; onChange: (v: T) => void; label: string; size?: "md" | "lg"; full?: boolean; labelOf?: (v: T) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n]);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx("gap-1 rounded-md bg-neutral-100 p-1", full ? "flex" : "inline-flex")}>
      {options.map((o, i) => {
        const on = o === value;
        return (
          <button key={String(o)} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on}
            tabIndex={on || (value === null && i === 0) ? 0 : -1} onClick={() => onChange(o)} onKeyDown={(e) => onKey(e, i)}
            className={cx("rounded-[9px] font-semibold transition-colors", size === "lg" ? "h-12 text-[15px]" : "h-11 px-5 text-[15px]", full && "flex-1",
              on ? "bg-teal-600 text-white" : "bg-transparent text-teal-900 hover:bg-neutral-200")}>
            {labelOf ? labelOf(o) : String(o)}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── Form fields (48px, radius 8, error = 1.5px red + soft red bg + message) ───────── */
const fieldBase = "h-12 w-full rounded-sm border bg-white px-3.5 text-base text-ink placeholder:text-neutral-500";
export const fieldClass = (error?: string | null) => cx(fieldBase, error ? "border-[1.5px] border-brick-500 bg-brick-50" : "border-line-input");

export function Field({ label, optional, bare, error, hint, children }: { label: string; optional?: boolean; bare?: boolean; error?: string | null; hint?: string; children: (p: { id: string; describedBy?: string; invalid: boolean }) => ReactNode }) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}{bare ? null : optional ? <> <span className="font-normal text-ink-3">(optional)</span></> : <> <span className="text-brick-500" aria-hidden="true">*</span><span className="sr-only"> (required)</span></>}
      </label>
      {children({ id, describedBy: error || hint ? msgId : undefined, invalid: !!error })}
      {error ? <span id={msgId} role="alert" className="text-[13px] font-medium text-brick-500">{error}</span> : hint ? <span id={msgId} className="text-[13px] text-ink-3">{hint}</span> : null}
    </div>
  );
}

/* ───────── Misc ───────── */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold", className)}>{children}</span>;
}

export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return <span role="presentation" style={{ width: size, height: size }} className={cx("spin inline-block shrink-0 rounded-full border-[3px] border-saffron-400 border-t-neutral-100", className)} />;
}

export function Banner({ tone = "tip", children, className, role }: { tone?: "tip" | "limit" | "error" | "success"; children: ReactNode; className?: string; role?: "alert" | "status" }) {
  const tones = { tip: "bg-cream-200 text-oxblood", limit: "bg-saffron-100 text-saffron-800", error: "bg-brick-100 text-brick-700", success: "bg-teal-100 text-teal-900" };
  return <div role={role ?? (tone === "error" ? "alert" : "status")} className={cx("rounded-md px-4 py-3 text-[15px] leading-snug", tones[tone], className)}>{children}</div>;
}

export function Card({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <Tag className={cx("rounded-lg border border-line bg-white", className)}>{children}</Tag>;
}

export const Overline = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cx("text-xs font-semibold uppercase tracking-[0.08em] text-teal-600", className)}>{children}</span>
);

/* ───────── Dialog (role=dialog, focus trap, Esc to close, scrim) ───────── */
export function Dialog({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children: ReactNode; actions: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? []).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab") {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(20,38,43,0.72)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className="flex w-full max-w-[440px] flex-col gap-3.5 rounded-xl bg-white p-6 text-ink shadow-3">
        <h2 id={`${id}-t`} className="text-2xl font-bold max-md:text-xl">{title}</h2>
        <div className="text-base leading-relaxed text-ink-2">{children}</div>
        <div className="flex flex-wrap-reverse justify-end gap-2.5 pt-1.5">{actions}</div>
      </div>
    </div>
  );
}
