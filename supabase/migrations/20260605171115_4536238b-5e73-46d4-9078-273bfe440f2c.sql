
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'comercial', 'personal', 'logistica', 'viewer');
CREATE TYPE public.event_type AS ENUM ('concierto', 'charla', 'exposicion', 'privado', 'publico', 'corporativo', 'boda', 'otro');
CREATE TYPE public.event_status AS ENUM ('borrador', 'planificacion', 'confirmado', 'en_curso', 'finalizado', 'cancelado');
CREATE TYPE public.item_category AS ENUM ('personal', 'catering', 'equipo', 'mobiliario', 'audio_video', 'iluminacion', 'transporte', 'seguridad', 'permisos', 'marketing', 'extras');
CREATE TYPE public.supplier_type AS ENUM ('interno', 'externo');

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User Roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles)) $$;

CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, NEW.raw_user_meta_data->>'avatar_url');
  -- First user becomes admin, rest become viewer
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  type supplier_type NOT NULL DEFAULT 'externo',
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  notes TEXT,
  rating NUMERIC(2,1),
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select_auth" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_write_logistic" ON public.suppliers FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]));
CREATE TRIGGER trg_suppliers_touch BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Personnel inventory
CREATE TABLE public.personnel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  email TEXT,
  phone TEXT,
  skills TEXT[],
  available BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personnel TO authenticated;
GRANT ALL ON public.personnel TO service_role;
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personnel_select_auth" ON public.personnel FOR SELECT TO authenticated USING (true);
CREATE POLICY "personnel_write_logistic" ON public.personnel FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','logistica']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','logistica']::app_role[]));
CREATE TRIGGER trg_personnel_touch BEFORE UPDATE ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Equipment inventory
CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category item_category NOT NULL DEFAULT 'equipo',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  condition TEXT DEFAULT 'bueno',
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipment_select_auth" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment_write_logistic" ON public.equipment FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','logistica']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','logistica']::app_role[]));
CREATE TRIGGER trg_equipment_touch BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Events
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_type event_type NOT NULL DEFAULT 'otro',
  status event_status NOT NULL DEFAULT 'borrador',
  description TEXT,
  location TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  attendees INTEGER DEFAULT 0,
  budget NUMERIC(12,2) DEFAULT 0,
  revenue NUMERIC(12,2) DEFAULT 0,
  ai_prompt TEXT,
  ai_summary TEXT,
  created_by UUID NOT NULL REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_auth" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_insert_creators" ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]));
CREATE POLICY "events_update_creators" ON public.events FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]));
CREATE POLICY "events_delete_admin" ON public.events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_events_touch BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Event Items
CREATE TABLE public.event_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  category item_category NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  supplier_id UUID REFERENCES public.suppliers ON DELETE SET NULL,
  personnel_id UUID REFERENCES public.personnel ON DELETE SET NULL,
  equipment_id UUID REFERENCES public.equipment ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_items_event ON public.event_items(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_items TO authenticated;
GRANT ALL ON public.event_items TO service_role;
ALTER TABLE public.event_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_items_select_auth" ON public.event_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "event_items_write" ON public.event_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','logistica','comercial']::app_role[]));
CREATE TRIGGER trg_event_items_touch BEFORE UPDATE ON public.event_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
