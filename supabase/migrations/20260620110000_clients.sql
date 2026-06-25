-- Clients table for Celeris. Multi-tenant: all rows scoped by organization_id.
-- Idempotent via IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.clients (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  contact_name    text,
  email           text,
  phone           text,
  address         text,
  tax_id          text,       -- NIT / RUT for billing
  notes           text,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_org" ON public.clients
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(),
          ARRAY['admin','comercial','viewer','contable']::public.app_role[])
    OR public.is_super_admin());

CREATE POLICY "clients_write_org" ON public.clients
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(),
          ARRAY['admin','comercial']::public.app_role[]))
  WITH CHECK (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(),
          ARRAY['admin','comercial']::public.app_role[]));

CREATE TRIGGER trg_clients_touch
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Link events to clients (nullable so existing events are unaffected)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
