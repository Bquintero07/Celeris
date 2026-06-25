import { supabase } from "./supabase";
import type { TenantConfig } from "@celeris/shared";

const BASE = import.meta.env.VITE_API_URL ?? "";

function getOrgSlug(): string | null {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return new URLSearchParams(window.location.search).get("org");
  }
  const parts = hostname.split(".");
  return parts.length >= 3 ? (parts[0] ?? null) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const orgSlug = getOrgSlug();
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(orgSlug ? { "X-Org-Slug": orgSlug } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  tenant: {
    config: () => request<TenantConfig>("/tenant/config"),
  },
  dashboard: {
    stats: () => request<any>("/dashboard/stats"),
  },

  events: {
    list: () => request<any[]>("/events"),
    get: (id: string) => request<any>(`/events/${id}`),
    create: (body: unknown) =>
      request<any>("/events", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, patch: unknown) =>
      request<any>(`/events/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    delete: (id: string) =>
      request<void>(`/events/${id}`, { method: "DELETE" }),
    bulkAddItems: (eventId: string, items: unknown[]) =>
      request<void>(`/events/${eventId}/items/bulk`, {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    exportPdf: (eventId: string, currency: string) =>
      request<{ base64: string; filename: string }>(`/events/${eventId}/export/pdf`, {
        method: "POST",
        body: JSON.stringify({ currency }),
      }),
    exportExcel: (eventId: string, currency: string) =>
      request<{ base64: string; filename: string }>(`/events/${eventId}/export/excel`, {
        method: "POST",
        body: JSON.stringify({ currency }),
      }),
    items: {
      add: (eventId: string, item: unknown) =>
        request<any>(`/events/${eventId}/items`, { method: "POST", body: JSON.stringify(item) }),
      update: (itemId: string, patch: unknown) =>
        request<any>(`/events/items/${itemId}`, { method: "PATCH", body: JSON.stringify(patch) }),
      delete: (itemId: string) =>
        request<void>(`/events/items/${itemId}`, { method: "DELETE" }),
    },
  },

  equipment: {
    list: () => request<any[]>("/equipment"),
    upsert: (data: unknown) =>
      request<any>("/equipment", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/equipment/${id}`, { method: "DELETE" }),
  },

  suppliers: {
    list: () => request<any[]>("/suppliers"),
    upsert: (data: unknown) =>
      request<any>("/suppliers", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/suppliers/${id}`, { method: "DELETE" }),
  },

  personnel: {
    list: () => request<any[]>("/personnel"),
    upsert: (data: unknown) =>
      request<any>("/personnel", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/personnel/${id}`, { method: "DELETE" }),
  },

  team: {
    list: () => request<any[]>("/team"),
    setRole: (data: { user_id: string; role: string; action: "add" | "remove" }) =>
      request<void>("/team/roles", { method: "POST", body: JSON.stringify(data) }),
    joinCode: () => request<{ join_code: string; name: string }>("/team/join-code"),
  },

  org: {
    get: () => request<any>("/org"),
    update: (data: unknown) =>
      request<any>("/org", { method: "PATCH", body: JSON.stringify(data) }),
  },

  onboarding: {
    status: () =>
      request<{ hasOrganization: boolean; isSuperAdmin: boolean }>("/onboarding/status"),
    createOrg: (data: { name: string }) =>
      request<any>("/onboarding/create-org", { method: "POST", body: JSON.stringify(data) }),
    joinOrg: (data: { code: string }) =>
      request<any>("/onboarding/join", { method: "POST", body: JSON.stringify(data) }),
  },

  roles: {
    mine: () => request<string[]>("/roles/mine"),
  },

  superAdmin: {
    check: () => request<boolean>("/super/check"),
    bootstrap: () => request<void>("/super/bootstrap", { method: "POST" }),
    listOrgs: () => request<any[]>("/super/orgs"),
    listUsers: () => request<any[]>("/super/users"),
    createOrg: (data: { name: string }) =>
      request<any>("/super/orgs", { method: "POST", body: JSON.stringify(data) }),
    assignUser: (data: { user_id: string; organization_id: string; makeAdmin: boolean }) =>
      request<void>("/super/assign", { method: "POST", body: JSON.stringify(data) }),
    grantSuper: (data: { user_id: string; grant: boolean }) =>
      request<void>("/super/grant", { method: "POST", body: JSON.stringify(data) }),
    deleteOrg: (organizationId: string) =>
      request<void>(`/super/orgs/${organizationId}`, { method: "DELETE" }),
  },

  quotes: {
    get: (eventId: string) => request<any>(`/quotes/${eventId}`),
    aiSuggest: (eventId: string, opts: { prompt?: string; budget?: number; currency?: string }) =>
      request<any>(`/quotes/${eventId}/ai-suggest`, { method: "POST", body: JSON.stringify(opts) }),
    apply: (eventId: string, lines: unknown[]) =>
      request<any>(`/quotes/${eventId}/apply`, { method: "POST", body: JSON.stringify({ lines }) }),
  },

  clients: {
    list: () => request<any[]>("/clients"),
    create: (data: unknown) =>
      request<any>("/clients", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request<any>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/clients/${id}`, { method: "DELETE" }),
  },

  availability: {
    equipment: (start: string, end: string, excludeEventId?: string) =>
      request<any[]>(`/availability/equipment?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}${excludeEventId ? `&excludeEventId=${excludeEventId}` : ""}`),
    personnel: (start: string, end: string, excludeEventId?: string) =>
      request<any[]>(`/availability/personnel?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}${excludeEventId ? `&excludeEventId=${excludeEventId}` : ""}`),
  },

  analytics: {
    margins: (params?: { since?: string; until?: string; groupBy?: "event" | "client" }) => {
      const q = new URLSearchParams();
      if (params?.since)   q.set("since",   params.since);
      if (params?.until)   q.set("until",   params.until);
      if (params?.groupBy) q.set("groupBy", params.groupBy);
      return request<any[]>(`/analytics/margins?${q}`);
    },
    revenue: (params?: { since?: string; until?: string }) => {
      const q = new URLSearchParams();
      if (params?.since) q.set("since", params.since);
      if (params?.until) q.set("until", params.until);
      return request<any[]>(`/analytics/revenue?${q}`);
    },
  },

  billing: {
    list: () => request<any[]>("/billing"),
    generateInvoice: (eventId: string, currency = "COP") =>
      request<{ base64: string; filename: string }>(`/billing/${eventId}/invoice`, {
        method: "POST",
        body: JSON.stringify({ currency }),
      }),
  },

  templates: {
    list: (event_type?: string) =>
      request<any[]>(`/templates${event_type ? `?event_type=${encodeURIComponent(event_type)}` : ""}`),
    get: (id: string) => request<any>(`/templates/${id}`),
    create: (data: unknown) =>
      request<any>("/templates", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/templates/${id}`, { method: "DELETE" }),
    apply: (templateId: string, eventId: string) =>
      request<any[]>(`/templates/${templateId}/apply/${eventId}`, { method: "POST" }),
  },

  approval: {
    submit:  (eventId: string, note?: string) =>
      request<any>(`/events/${eventId}/submit`,  { method: "POST", body: JSON.stringify({ note }) }),
    approve: (eventId: string, note?: string) =>
      request<any>(`/events/${eventId}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
    send:    (eventId: string, note?: string) =>
      request<any>(`/events/${eventId}/send`,    { method: "POST", body: JSON.stringify({ note }) }),
    reject:  (eventId: string, note?: string) =>
      request<any>(`/events/${eventId}/reject`,  { method: "POST", body: JSON.stringify({ note }) }),
    log:     (eventId: string) => request<any[]>(`/events/${eventId}/approval-log`),
  },

  ai: {
    generate: (data: {
      prompt: string;
      template: string | null;
      currency: string;
      budget_cap: number | null;
    }) => request<any>("/ai/generate", { method: "POST", body: JSON.stringify(data) }),
  },
};
