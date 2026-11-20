import Image from "next/image";

export function LogoMark({ size = 32 }: { size?: number }) {
  return <Image src="/brand/skillora-icon.png" alt="" width={size} height={size} priority className="object-contain" style={{ width: size, height: size }} />;
}

/** The design's illustrated interviewer "Riya" (placeholder avatar kept per handoff §12). */
export function InterviewerAvatar({ width, height, label = "AI interviewer" }: { width: number; height: number; label?: string }) {
  return (
    <svg width={width} height={height} viewBox="0 0 260 300" role="img" aria-label={label}>
      <path d="M30 300c0-62 45-100 100-100s100 38 100 100z" fill="#5F8994" />
      <path d="M108 196h44v26a22 22 0 0 1-44 0z" fill="#E9B98A" />
      <ellipse cx="130" cy="128" rx="60" ry="70" fill="#F2C79B" />
      <path d="M70 120c0-48 28-74 62-74s58 24 58 70c-16-18-36-28-60-30-24 2-44 14-60 34z" fill="#3A2A22" />
      <ellipse cx="108" cy="132" rx="6" ry="7" fill="#1C3238" />
      <ellipse cx="152" cy="132" rx="6" ry="7" fill="#1C3238" />
      <path d="M112 166c10 10 26 10 36 0" stroke="#9E2A2B" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function initials(name: string | null | undefined, fallback = "S") {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
