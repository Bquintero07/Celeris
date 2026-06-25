import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "./api";

function hexToOklch(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "67% 0.22 270";
  const num = parseInt(m[1]!, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  // sRGB → linear
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  // linear sRGB → XYZ D65
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  const z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;
  // XYZ → OKLab
  const l0 = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m0 = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s0 = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z);
  const L = 0.2104542553 * l0 + 0.7936177850 * m0 - 0.0040720468 * s0;
  const a = 1.9779984951 * l0 - 2.4285922050 * m0 + 0.4505937099 * s0;
  const bk = 0.0259040371 * l0 + 0.7827717662 * m0 - 0.8086757660 * s0;
  const C = Math.sqrt(a * a + bk * bk);
  const H = (Math.atan2(bk, a) * 180) / Math.PI;
  return `${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${((H + 360) % 360).toFixed(1)}`;
}

function applyBrandingVars(primary: string, accent: string) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", hexToOklch(primary));
  root.style.setProperty("--brand-accent", hexToOklch(accent));
  // Also keep legacy HSL vars for compatibility
  root.style.setProperty("--primary-hex", primary);
  root.style.setProperty("--accent-hex", accent);
}

export function useTenantConfig() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setHasSession(!!s);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const q = useQuery({
    queryKey: ["tenant-config"],
    queryFn: () => api.tenant.config(),
    staleTime: 60_000,
    enabled: hasSession,
    retry: false,
  });

  useEffect(() => {
    if (!q.data?.branding) return;
    const { primary, accent } = q.data.branding;
    applyBrandingVars(primary ?? "#7C5CFF", accent ?? "#22D3EE");
  }, [q.data]);

  return q;
}
