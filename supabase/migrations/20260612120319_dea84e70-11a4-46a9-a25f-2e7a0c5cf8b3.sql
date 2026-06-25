
-- 1) New signups: only create a profile. No org, no role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Organizations: invitation code
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS join_code text;

-- Backfill join_code for existing organizations
UPDATE public.organizations
SET join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE join_code IS NULL;

ALTER TABLE public.organizations
  ALTER COLUMN join_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_join_code_key
  ON public.organizations (join_code);

-- 3) Tighten profile visibility for admins: only same org
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin_same_org"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND organization_id = public.current_org_id()
  );
