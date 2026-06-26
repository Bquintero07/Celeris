// Thin wrapper over the Supabase Auth Admin REST API.
// Used by super-admin routes to create / delete / reset users without pulling in
// the @supabase/supabase-js dependency — we already talk to other services via fetch.

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function adminHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function adminFetch(path: string, init: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: { ...adminHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(text || `Supabase admin error ${res.status}`), {
      status: res.status === 422 ? 409 : res.status,
    });
  }
  return res.status === 204 ? null : res.json();
}

export type AdminUser = { id: string; email: string };

export function createAuthUser(input: {
  email: string;
  password: string;
  full_name?: string;
}): Promise<AdminUser> {
  return adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: input.full_name ? { full_name: input.full_name } : {},
    }),
  });
}

export function setUserPassword(userId: string, password: string): Promise<AdminUser> {
  return adminFetch(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

export function deleteAuthUser(userId: string): Promise<null> {
  return adminFetch(`/users/${userId}`, { method: "DELETE" }) as Promise<null>;
}
