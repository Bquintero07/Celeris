
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#7C5CFF',
  accent_color text NOT NULL DEFAULT '#22D3EE',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_organizations_touch BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT organization_id FROM public.profiles WHERE id = auth.uid() $$;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, service_role;

CREATE POLICY "org_select_member" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id());
CREATE POLICY "org_update_admin" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "org_insert_owner" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

ALTER TABLE public.events     ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.personnel  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.equipment  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.event_items ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

DO $$
DECLARE v_org uuid; v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF v_owner IS NULL THEN SELECT id INTO v_owner FROM public.profiles LIMIT 1; END IF;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.organizations (name, slug, created_by) VALUES ('Mi Empresa', 'mi-empresa', v_owner) RETURNING id INTO v_org;
    UPDATE public.profiles    SET organization_id = v_org WHERE organization_id IS NULL;
    UPDATE public.events      SET organization_id = v_org WHERE organization_id IS NULL;
    UPDATE public.personnel   SET organization_id = v_org WHERE organization_id IS NULL;
    UPDATE public.suppliers   SET organization_id = v_org WHERE organization_id IS NULL;
    UPDATE public.equipment   SET organization_id = v_org WHERE organization_id IS NULL;
    UPDATE public.event_items SET organization_id = v_org WHERE organization_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.events     ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.personnel  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.suppliers  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.equipment  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.event_items ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_events_org      ON public.events(organization_id);
CREATE INDEX idx_personnel_org   ON public.personnel(organization_id);
CREATE INDEX idx_suppliers_org   ON public.suppliers(organization_id);
CREATE INDEX idx_equipment_org   ON public.equipment(organization_id);
CREATE INDEX idx_event_items_org ON public.event_items(organization_id);
CREATE INDEX idx_profiles_org    ON public.profiles(organization_id);

DROP POLICY IF EXISTS "events_select_auth"      ON public.events;
DROP POLICY IF EXISTS "events_insert_creators"  ON public.events;
DROP POLICY IF EXISTS "events_update_creators"  ON public.events;
DROP POLICY IF EXISTS "events_delete_admin"     ON public.events;
CREATE POLICY "events_select_org" ON public.events FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "events_insert_org" ON public.events FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND auth.uid() = created_by
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]));
CREATE POLICY "events_update_org" ON public.events FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]));
CREATE POLICY "events_delete_org" ON public.events FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "personnel_select_privileged" ON public.personnel;
DROP POLICY IF EXISTS "personnel_select_self"       ON public.personnel;
DROP POLICY IF EXISTS "personnel_write_logistic"    ON public.personnel;
CREATE POLICY "personnel_select_org" ON public.personnel FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id()
    AND (public.has_any_role(auth.uid(), ARRAY['admin','logistica']::app_role[]) OR user_id = auth.uid()));
CREATE POLICY "personnel_write_org" ON public.personnel TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica']::app_role[]))
  WITH CHECK (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica']::app_role[]));

DROP POLICY IF EXISTS "suppliers_select_privileged" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_write_logistic"    ON public.suppliers;
CREATE POLICY "suppliers_select_org" ON public.suppliers FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial','contable']::app_role[]));
CREATE POLICY "suppliers_write_org" ON public.suppliers TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]))
  WITH CHECK (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]));

DROP POLICY IF EXISTS "equipment_select_auth"     ON public.equipment;
DROP POLICY IF EXISTS "equipment_write_logistic"  ON public.equipment;
CREATE POLICY "equipment_select_org" ON public.equipment FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "equipment_write_org" ON public.equipment TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica']::app_role[]))
  WITH CHECK (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica']::app_role[]));

DROP POLICY IF EXISTS "event_items_select_auth" ON public.event_items;
DROP POLICY IF EXISTS "event_items_write_auth"  ON public.event_items;
CREATE POLICY "event_items_select_org" ON public.event_items FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "event_items_write_org" ON public.event_items TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]))
  WITH CHECK (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  INSERT INTO public.organizations (name, created_by)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mi Empresa'), NEW.id)
    RETURNING id INTO v_org;
  INSERT INTO public.profiles (id, full_name, email, avatar_url, organization_id)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            NEW.email, NEW.raw_user_meta_data->>'avatar_url', v_org);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;
