-- RLS policy: admin/comercial/viewer see all org events;
-- logistica/personal see only events they are assigned to via event_items.personnel_id.
-- Idempotent: replaces the existing flat "events_select_org" policy.

DROP POLICY IF EXISTS "events_select_org"        ON public.events;
DROP POLICY IF EXISTS "events_select_org_all"    ON public.events;
DROP POLICY IF EXISTS "events_select_org_scoped" ON public.events;

CREATE POLICY "events_select_org_all" ON public.events
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.has_any_role(
        auth.uid(),
        ARRAY['admin','comercial','viewer','contable']::public.app_role[]
      )
      OR public.is_super_admin()
      OR (
        public.has_any_role(
          auth.uid(),
          ARRAY['logistica','personal']::public.app_role[]
        )
        AND id IN (
          SELECT DISTINCT ei.event_id
          FROM   public.event_items ei
          JOIN   public.personnel   p  ON p.id = ei.personnel_id
          WHERE  p.user_id           = auth.uid()
            AND  ei.organization_id  = public.current_org_id()
        )
      )
    )
  );
