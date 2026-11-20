/** Data-driven score ring: r=60, stroke 12, dasharray round(score/100*377) 377, rotated -90 (design spec). */
export function ScoreRing({ score, color, track, label }: { score: number; color: string; track: string; label: string }) {
  const dash = Math.round((score / 100) * 377);
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg width="132" height="132" viewBox="0 0 140 140" role="img" aria-label={label}>
        <circle cx="70" cy="70" r="60" fill="none" stroke={track} strokeWidth="12" />
        <circle cx="70" cy="70" r="60" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} 377`} transform="rotate(-90 70 70)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-[40px] font-bold leading-none">{score}</span><span className="text-xs text-ink-3">out of 100</span>
      </div>
    </div>
  );
}
