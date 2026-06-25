import { useTenantConfig } from "./useTenantConfig";

export function useBranding() {
  const q = useTenantConfig();
  const branding = q.data?.branding ?? null;
  return {
    ...q,
    data: branding
      ? {
          primary_color: branding.primary,
          accent_color: branding.accent,
          logo_url: branding.logoUrl ?? null,
          name: branding.name ?? null,
        }
      : null,
  };
}
