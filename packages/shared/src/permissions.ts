// Single source of truth for RBAC. Used by both web (hide UI) and api (assertCan).
export type Role = "admin" | "comercial" | "contable" | "logistica" | "personal" | "viewer";

export const PERMISSIONS: Record<Role, string[]> = {
  admin: ["*"],
  contable: [
    "events.view_all", "quotes.view", "quotes.view_margin", "quotes.export",
    "analytics.view", "clients.view", "suppliers.view",
  ],
  comercial: [
    "events.view_all", "events.create", "events.edit",
    "quotes.view", "quotes.edit", "quotes.view_margin", "quotes.export",
    "clients.manage", "inventory.view", "suppliers.view", "suppliers.edit", "crew.view", "analytics.view",
  ],
  logistica: [
    "events.view_assigned", "events.items.manage", "quotes.view", "inventory.view", "crew.view_own",
    "quotes.export_own", "clients.view",
  ],
  personal: ["events.view_assigned", "crew.view_own"],
  viewer: [
    "events.view_all", "events.view", "quotes.view", "inventory.view",
    "suppliers.view", "analytics.view", "clients.view",
  ],
};

/** A user may hold several roles -> aggregate their permissions. */
export function can(roles: Role[], perm: string): boolean {
  return roles.some((r) => {
    const list = PERMISSIONS[r] ?? [];
    return list.includes("*") || list.includes(perm);
  });
}

// Module catalog (feature flags). 'events_quotes' is the always-on core.
export const MODULES = [
  "events_quotes", "inventory", "suppliers", "crew",
  "ai_assistant", "analytics", "branding",
  "approval", "billing", "notifications",
] as const;
export type ModuleKey = (typeof MODULES)[number];
