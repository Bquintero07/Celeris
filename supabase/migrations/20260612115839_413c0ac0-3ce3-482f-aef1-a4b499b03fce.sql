
-- 1) user_roles: scope admin writes to same organization
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;

CREATE POLICY "user_roles_admin_same_org"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.organization_id = public.current_org_id()
    )
    AND role <> 'super_admin'::public.app_role
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.organization_id = public.current_org_id()
    )
    AND role <> 'super_admin'::public.app_role
  );

-- 2) storage: scope branding writes to the admin's own organization folder
-- Convention: object name path = '{organization_id}/...'
DROP POLICY IF EXISTS "org_branding_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "org_branding_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "org_branding_admin_delete" ON storage.objects;

CREATE POLICY "org_branding_admin_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'org-branding'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY "org_branding_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'org-branding'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  )
  WITH CHECK (
    bucket_id = 'org-branding'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY "org_branding_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'org-branding'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );
