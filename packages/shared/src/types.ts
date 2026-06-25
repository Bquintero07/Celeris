import type { Role, ModuleKey } from "./permissions.js";

export interface AuthContext {
  userId: string;
  orgId: string | null;
  roles: Role[];
  isSuperAdmin: boolean;
}

export interface TenantConfig {
  enabledModules: ModuleKey[];
  branding: { logoUrl: string | null; primary: string; accent: string; name?: string | null };
  roles: Role[];
  isSuperAdmin?: boolean;
}

// Contract shared with the Python agent (POST /quote/suggest)
export interface QuoteSuggestLine {
  category: "equipment" | "crew" | "supplier";
  name: string;
  source: "owned" | "external";
  quantity: number;
  days: number;
  unitCost: number;
  markup: number;
  availability: string;
}
export interface QuoteSuggestResponse {
  lines: QuoteSuggestLine[];
  notes: string[];
}
