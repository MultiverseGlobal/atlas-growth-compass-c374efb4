export function LogoMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  // Hollow ink circle with solid gold dot centered, short dotted line dropping below.
  return (
    <svg
      width={size}
      height={size * 1.35}
      viewBox="0 0 24 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" fill="none" opacity="0.85" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <line
        x1="12"
        y1="22"
        x2="12"
        y2="30"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeDasharray="1.5 3"
        opacity="0.6"
      />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={22} />
      <span className="font-display text-xl font-semibold tracking-tight" style={{ fontWeight: 650 }}>
        Atlas
      </span>
    </div>
  );
}
