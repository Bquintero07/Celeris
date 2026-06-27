type Props = { size?: number; className?: string; title?: string };

// The Celeris brand mark. Uses the same asset as the favicon so the logo is
// consistent everywhere (login, sidebar, exports).
export function CelerisLogo({ size = 32, className, title = "Celeris" }: Props) {
  return (
    <img
      src="/favicon.png"
      width={size}
      height={size}
      className={className}
      alt={title}
      style={{ objectFit: "contain" }}
    />
  );
}

export function CelerisWordmark({ className }: { className?: string }) {
  return (
    <span className={"font-display font-bold tracking-tight " + (className ?? "")}>
      Celeris
    </span>
  );
}
