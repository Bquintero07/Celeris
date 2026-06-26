import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "./api";
import { supabase } from "@/lib/supabase";
import { can as sharedCan } from "@celeris/shared";
import type { Role, ModuleKey } from "@celeris/shared";

export type { Role, ModuleKey };
export { sharedCan as can };

export type AppRole =
  | "super_admin"
  | "admin"
  | "comercial"
  | "contable"
  | "personal"
  | "logistica"
  | "viewer";

export function useMyRoles() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => api.roles.mine(),
    staleTime: 60_000,
    enabled: hasSession,
    retry: false,
  });

  const roles = (data ?? []) as AppRole[];
  const isSuperAdmin = roles.includes("super_admin");
  const nonSuperRoles = roles.filter((r) => r !== "super_admin") as Role[];

  return {
    roles,
    nonSuperRoles,
    isLoading,
    isSuperAdmin,
    isAdmin: roles.includes("admin") || isSuperAdmin,
    has: (r: AppRole) => roles.includes(r),
    hasAny: (rs: AppRole[]) => rs.some((r) => roles.includes(r)),
    can: (perm: string) => isSuperAdmin || sharedCan(nonSuperRoles, perm),
  };
}

export const NAV_MODULE: Record<string, ModuleKey | null> = {
  "/dashboard":      null,
  "/events":         "events_quotes",
  "/clients":        "events_quotes",
  "/inventory":      "inventory",
  "/personnel":      "crew",
  "/suppliers":      "suppliers",
  "/analytics":      "analytics",
  "/billing":        "billing",
  "/team":           null,
  "/brand-settings": "branding",
  "/admin":          null,
};

export const NAV_ACCESS: Record<string, AppRole[]> = {
  "/dashboard":      ["admin", "comercial", "contable", "personal", "logistica", "viewer"],
  "/events":         ["admin", "comercial", "contable", "personal", "logistica", "viewer"],
  "/clients":        ["admin", "comercial", "logistica", "viewer"],
  "/inventory":      ["admin", "logistica", "comercial"],
  "/personnel":      ["admin", "logistica"],
  "/suppliers":      ["admin", "comercial"],
  "/analytics":      ["admin", "comercial", "contable"],
  "/billing":        ["admin", "comercial", "contable"],
  "/team":           ["admin"],
  "/brand-settings": ["admin"],
  "/admin":          ["super_admin"],
};

export function canSeeNav(
  url: string,
  roles: AppRole[],
  enabledModules?: string[],
): boolean {
  // super_admin uses the dedicated operator console (/admin), not the tenant nav,
  // so it gets no blanket access here — it's gated by its actual tenant roles (usually none).

  // Module gate: if a module is required and not in the org's enabled list, hide it
  const requiredModule = NAV_MODULE[url];
  if (requiredModule && enabledModules && !enabledModules.includes(requiredModule)) {
    return false;
  }

  if (roles.includes("admin") && url !== "/admin") return true;
  const allowed = NAV_ACCESS[url];
  if (!allowed) return true;
  return allowed.some((r) => roles.includes(r));
}
