-- Approval flow for quotes/events.
-- Adds approval_status to events and an immutable audit log.

-- 1. Approval status on events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft','review','approved','sent','rejected'));

-- 2. Audit log (append-only; never update/delete)
CREATE TABLE IF NOT EXISTS public.approval_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_status     text        NOT NULL,
  to_status       text        NOT NULL,
  actor_id        uuid        NOT NULL REFERENCES auth.users(id),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_log_event ON public.approval_log(event_id);

GRANT SELECT, INSERT ON public.approval_log TO authenticated;
GRANT ALL ON public.approval_log TO service_role;

ALTER TABLE public.approval_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_log_select_org" ON public.approval_log
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY "approval_log_insert_org" ON public.approval_log
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
