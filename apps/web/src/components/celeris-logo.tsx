type Props = { size?: number; className?: string; title?: string };

export function CelerisLogo({ size = 32, className, title = "Celeris" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="celeris-g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand-primary, 252 90% 67%))" />
          <stop offset="100%" stopColor="hsl(var(--brand-accent, 189 94% 55%))" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#celeris-g1)" />
      <path d="M32 12 L48 44 L16 44 Z" fill="white" fillOpacity="0.12" />
      <path
        d="M44 24c-2.6-3.6-6.9-6-11.7-6C24.4 18 18 24.4 18 32.3c0 7.9 6.4 14.3 14.3 14.3 4.7 0 8.8-2.2 11.4-5.7"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M46 18 L48 22 L52 24 L48 26 L46 30 L44 26 L40 24 L44 22 Z" fill="white" />
    </svg>
  );
}

export function CelerisWordmark({ className }: { className?: string }) {
  return (
    <span className={"font-display font-bold tracking-tight " + (className ?? "")}>
      Celeris
    </span>
  );
}
