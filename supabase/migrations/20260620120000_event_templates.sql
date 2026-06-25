-- Event templates: reusable line-item sets per event type.
-- Applying a template bulk-inserts its items into an event.

CREATE TABLE IF NOT EXISTS public.event_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  event_type      text        NOT NULL, -- matches event_type enum values
  description     text,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.template_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid        NOT NULL REFERENCES public.event_templates(id) ON DELETE CASCADE,
  category        public.item_category NOT NULL,
  name            text        NOT NULL,
  quantity        numeric(14,2) NOT NULL DEFAULT 1,
  unit_cost       numeric(18,2) NOT NULL DEFAULT 0,
  markup_pct      numeric(5,2)  NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_templates_org  ON public.event_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_template_items_tpl   ON public.template_items(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_items  TO authenticated;
GRANT ALL ON public.event_templates TO service_role;
GRANT ALL ON public.template_items  TO service_role;

ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_templates_select_org" ON public.event_templates
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY "event_templates_write_org" ON public.event_templates
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','comercial']::public.app_role[]))
  WITH CHECK (organization_id = public.current_org_id()
    AND public.has_any_role(auth.uid(), ARRAY['admin','comercial']::public.app_role[]));

CREATE POLICY "template_items_select_org" ON public.template_items
  FOR SELECT TO authenticated
  USING (
    template_id IN (
      SELECT id FROM public.event_templates WHERE organization_id = public.current_org_id()
    )
  );

CREATE POLICY "template_items_write_org" ON public.template_items
  FOR ALL TO authenticated
  USING (
    template_id IN (
      SELECT id FROM public.event_templates
      WHERE organization_id = public.current_org_id()
        AND public.has_any_role(auth.uid(), ARRAY['admin','comercial']::public.app_role[])
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM public.event_templates
      WHERE organization_id = public.current_org_id()
        AND public.has_any_role(auth.uid(), ARRAY['admin','comercial']::public.app_role[])
    )
  );

CREATE TRIGGER trg_event_templates_touch
  BEFORE UPDATE ON public.event_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
