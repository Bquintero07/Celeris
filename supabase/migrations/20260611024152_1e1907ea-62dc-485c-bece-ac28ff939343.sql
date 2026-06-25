
-- Helper: is current user a super admin?
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role) $$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Add super_admin override policies to every tenant-scoped table
-- ORGANIZATIONS
DROP POLICY IF EXISTS "super_admin all organizations" ON public.organizations;
CREATE POLICY "super_admin all organizations" ON public.organizations
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- PROFILES
DROP POLICY IF EXISTS "super_admin all profiles" ON public.profiles;
CREATE POLICY "super_admin all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- USER_ROLES
DROP POLICY IF EXISTS "super_admin all user_roles" ON public.user_roles;
CREATE POLICY "super_admin all user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- EVENTS
DROP POLICY IF EXISTS "super_admin all events" ON public.events;
CREATE POLICY "super_admin all events" ON public.events
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- PERSONNEL
DROP POLICY IF EXISTS "super_admin all personnel" ON public.personnel;
CREATE POLICY "super_admin all personnel" ON public.personnel
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- SUPPLIERS
DROP POLICY IF EXISTS "super_admin all suppliers" ON public.suppliers;
CREATE POLICY "super_admin all suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- EQUIPMENT
DROP POLICY IF EXISTS "super_admin all equipment" ON public.equipment;
CREATE POLICY "super_admin all equipment" ON public.equipment
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- EVENT_ITEMS
DROP POLICY IF EXISTS "super_admin all event_items" ON public.event_items;
CREATE POLICY "super_admin all event_items" ON public.event_items
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
