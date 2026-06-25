import { createClient } from "@supabase/supabase-js";
// Supabase is used ONLY for Auth (login/sign-up) and Storage — NOT for data.
// All data goes through the Node API (see lib/api.ts).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
