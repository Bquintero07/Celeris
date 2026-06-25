
-- 1. Remove duplicate permissive ALL policy on event_items
DROP POLICY IF EXISTS event_items_write ON public.event_items;

-- 2. Add organization_id to user_roles and scope role checks
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill from profiles (skip super_admin so super_admins remain global)
UPDATE public.user_roles ur
SET organization_id = p.organization_id
FROM public.profiles p
WHERE ur.user_id = p.id
  AND ur.organization_id IS NULL
  AND ur.role <> 'super_admin';

CREATE INDEX IF NOT EXISTS user_roles_user_org_idx ON public.user_roles(user_id, organization_id);

-- Update has_role: super_admin is global; other roles must match caller's current org
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND (
        ur.role = 'super_admin'
        OR ur.organization_id IS NOT DISTINCT FROM (
          SELECT organization_id FROM public.profiles WHERE id = _user_id
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY(_roles)
      AND (
        ur.role = 'super_admin'
        OR ur.organization_id IS NOT DISTINCT FROM (
          SELECT organization_id FROM public.profiles WHERE id = _user_id
        )
      )
  )
$$;
