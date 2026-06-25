
CREATE POLICY "org_branding_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'org-branding');
CREATE POLICY "org_branding_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "org_branding_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "org_branding_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-branding' AND public.has_role(auth.uid(), 'admin'));
