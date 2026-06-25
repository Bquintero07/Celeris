-- Migration: tenant provisioning, module activation, and first-user-becomes-admin
-- Additive and idempotent. Safe to run on top of the existing Celeris schema.
-- Requires: public.organizations(slug), public.profiles(organization_id),
--           public.user_roles(user_id, role, organization_id), enum public.app_role.

-- 1) Tenant provisioning fields on organizations -----------------------------
alter table public.organizations
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended'));

alter table public.organizations
  add column if not exists enabled_modules text[] not null
    default array[
      'events_quotes', -- core, always on
      'inventory',
      'suppliers',
      'crew',
      'ai_assistant',
      'analytics',
      'branding'
    ];
-- Optional modules a tenant can have OFF by default: 'billing', 'notifications', 'approval'.

-- 2) Module gate: is a given module enabled for the caller's current org? -----
create or replace function public.org_has_module(_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = public.current_org_id()
      and _module = any (o.enabled_modules)
  );
$$;

-- 3) Claim membership on registration ----------------------------------------
--    First user of the org  -> role 'admin' and the org becomes 'active'.
--    Any later user         -> role 'viewer' (the org admin upgrades them later).
--    The org row is locked to avoid two "first users" racing.
create or replace function public.claim_org_membership(p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org     public.organizations;
  v_members integer;
  v_uid     uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Lock the org row so concurrent registrations are serialized.
  select * into v_org
  from public.organizations
  where slug = p_slug
  for update;

  if v_org.id is null then
    raise exception 'organization not found for slug %', p_slug;
  end if;

  -- Link the caller to this org (only if not already linked).
  update public.profiles
  set organization_id = v_org.id
  where id = v_uid
    and organization_id is distinct from v_org.id;

  select count(*) into v_members
  from public.profiles
  where organization_id = v_org.id;

  if v_members <= 1 then
    -- First user: org admin + activate the org.
    insert into public.user_roles (user_id, role, organization_id)
    values (v_uid, 'admin', v_org.id)
    on conflict (user_id, role) do nothing;

    update public.organizations
    set status = 'active', updated_at = now()
    where id = v_org.id and status = 'pending';
  else
    -- Later users: minimal role until the org admin assigns one.
    insert into public.user_roles (user_id, role, organization_id)
    values (v_uid, 'viewer', v_org.id)
    on conflict (user_id, role) do nothing;
  end if;

  select * into v_org from public.organizations where id = v_org.id;
  return v_org;
end;
$$;

grant execute on function public.org_has_module(text)      to authenticated;
grant execute on function public.claim_org_membership(text) to authenticated;

-- 4) (Optional hardening) Pin the intended owner email when provisioning.
-- If you want only a specific invited email to become admin, add
-- organizations.owner_email text and check it inside claim_org_membership.
