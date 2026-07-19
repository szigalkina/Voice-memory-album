// The one brand ornament: an engraved voice-waveform in hairlines.
export default function WaveMark({ className = "" }: { className?: string }) {
  const bars = [8, 14, 22, 30, 36, 30, 22, 14, 8];
  return (
    <span className={`inline-flex items-center gap-[5px] ${className}`} aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-px bg-ink/30"
          style={{ height: `${h}px` }}
        />
      ))}
    </span>
  );
}
