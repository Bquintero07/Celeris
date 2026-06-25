
-- Trigger on auth.users for new signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users that don't have org/profile/role
DO $$
DECLARE u RECORD; v_org uuid;
BEGIN
  FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles) LOOP
    INSERT INTO public.organizations (name, created_by)
      VALUES (COALESCE(u.raw_user_meta_data->>'company_name','Mi Empresa'), u.id)
      RETURNING id INTO v_org;
    INSERT INTO public.profiles (id, full_name, email, avatar_url, organization_id)
      VALUES (u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email,
              u.raw_user_meta_data->>'avatar_url', v_org);
    INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'admin') ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Promote the oldest user to super_admin (the platform owner)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users ORDER BY created_at ASC LIMIT 1
ON CONFLICT DO NOTHING;
