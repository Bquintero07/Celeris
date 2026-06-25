-- Align RLS with the app's RBAC model (packages/shared/src/permissions.ts).
-- Until now, RLS let 'logistica' write events/event_items/personnel/equipment/suppliers
-- directly via PostgREST + their own JWT, even where the Node app never intended that
-- (e.g. logistica only has events.view_assigned, never events.edit). Decisions:
--   - logistica: no longer creates/edits events directly.
--   - logistica: can still write event_items, but only on events it's already assigned
--     to (i.e. it already has a personnel slot there) — mirrors events.items.manage.
--   - logistica: no longer writes personnel/equipment directly (admin-only now).
--   - suppliers: write stays with admin + comercial (logistica dropped).

-- events: drop logistica from insert/update.
DROP POLICY IF EXISTS "events_insert_org" ON public.events;
CREATE POLICY "events_insert_org" ON public.events FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND auth.uid() = created_by
    AND public.has_any_role(auth.uid(), ARRAY['admin','comercial']::app_role[]));

DROP POLICY IF EXISTS "events_update_org" ON public.events;
CREATE POLICY "events_update_org" ON public.events FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','comercial']::app_role[]));

-- event_items: admin/comercial write any org item; logistica only on events it's assigned to.
DROP POLICY IF EXISTS "event_items_write_org" ON public.event_items;
CREATE POLICY "event_items_write_org" ON public.event_items TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin','comercial']::app_role[])
      OR (
        public.has_role(auth.uid(), 'logistica')
        AND event_id IN (
          SELECT DISTINCT ei.event_id
          FROM   public.event_items ei
          JOIN   public.personnel   p ON p.id = ei.personnel_id
          WHERE  p.user_id          = auth.uid()
            AND  ei.organization_id = public.current_org_id()
        )
      )
    )
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin','comercial']::app_role[])
      OR (
        public.has_role(auth.uid(), 'logistica')
        AND event_id IN (
          SELECT DISTINCT ei.event_id
          FROM   public.event_items ei
          JOIN   public.personnel   p ON p.id = ei.personnel_id
          WHERE  p.user_id          = auth.uid()
            AND  ei.organization_id = public.current_org_id()
        )
      )
    )
  );

-- personnel: admin-only write (logistica dropped — app has no crew.edit for any non-admin role).
DROP POLICY IF EXISTS "personnel_write_org" ON public.personnel;
CREATE POLICY "personnel_write_org" ON public.personnel TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'));

-- equipment: admin-only write (logistica dropped — app has no inventory.edit for any non-admin role).
DROP POLICY IF EXISTS "equipment_write_org" ON public.equipment;
CREATE POLICY "equipment_write_org" ON public.equipment TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'));

-- suppliers: admin + comercial write (logistica dropped); matches new suppliers.edit grant.
DROP POLICY IF EXISTS "suppliers_write_org" ON public.suppliers;
CREATE POLICY "suppliers_write_org" ON public.suppliers TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','comercial']::app_role[]))
  WITH CHECK (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','comercial']::app_role[]));

-- Note: suppliers_select_org already included 'contable' — only the app-side
-- permissions.ts was missing suppliers.view for contable (fixed there, not here).
