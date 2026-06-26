-- Global, operator-tuned settings for the Python AI agent.
-- Single-row table (id = 1). Read/written only by super admins through the Node API.

CREATE TABLE IF NOT EXISTS public.agent_config (
  id                  int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  model               text        NOT NULL DEFAULT 'gpt-4o-mini',
  temperature         numeric     NOT NULL DEFAULT 0.7,
  max_tokens          int,
  quote_system_prompt text,
  plan_system_prompt  text,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid
);

INSERT INTO public.agent_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Defensive RLS: only super admins. (The Node API connects as `postgres` and
-- bypasses RLS, so this just guards any direct authenticated access.)
ALTER TABLE public.agent_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin agent_config" ON public.agent_config;
CREATE POLICY "super_admin agent_config" ON public.agent_config
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
