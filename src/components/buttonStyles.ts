import { cx } from "@/lib/format";

// Buttons (design: heights 52/48/44/36, radius 12, 16/600)
export type ButtonVariant = "primary" | "accent" | "secondary" | "danger" | "dangerSoft" | "dangerOutline" | "ghost" | "onDark";
export type ButtonSize = "lg" | "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800",
  accent: "bg-saffron-400 text-teal-900 font-bold hover:bg-saffron-300",
  secondary: "border-[1.5px] border-teal-600 bg-white text-teal-600 hover:bg-teal-50",
  danger: "bg-brick-500 text-white hover:bg-brick-600",
  dangerSoft: "bg-brick-50 text-brick-500 hover:bg-brick-100",
  dangerOutline: "border-[1.5px] border-brick-500 bg-white text-brick-500 hover:bg-brick-50",
  ghost: "bg-transparent text-teal-600 hover:bg-teal-50",
  onDark: "bg-neutral-800 text-cream-50 hover:bg-neutral-700",
};
const SIZE: Record<ButtonSize, string> = { lg: "h-[52px] px-7 text-base", md: "h-12 px-6 text-[15px]", sm: "h-11 px-4 text-[15px]" };

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "lg", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 select-none",
    "disabled:bg-neutral-200 disabled:text-neutral-500 disabled:border-transparent disabled:hover:bg-neutral-200",
    SIZE[size], VARIANT[variant], extra,
  );
}

