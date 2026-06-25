
-- Tighten profiles SELECT: own profile only
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Admins can read all profiles (needed for team/admin views)
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tighten personnel SELECT: only admin and logistica (the roles that need contact/pay info)
DROP POLICY IF EXISTS personnel_select_auth ON public.personnel;
CREATE POLICY personnel_select_privileged ON public.personnel
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'logistica'::app_role]));

-- Allow a staff member linked via user_id to read their own personnel row
CREATE POLICY personnel_select_self ON public.personnel
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tighten suppliers SELECT: only admin, logistica, comercial, contable
DROP POLICY IF EXISTS suppliers_select_auth ON public.suppliers;
CREATE POLICY suppliers_select_privileged ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'logistica'::app_role, 'comercial'::app_role, 'contable'::app_role]));
