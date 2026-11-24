-- TFI_NEW / TFI2 — Migration 003: harden helper-function exposure and index access-control foreign keys.
-- Security-definer helpers used by RLS live in a non-API schema.
-- A public SECURITY INVOKER wrapper remains for the signed-in user's own access context.

begin;

create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;

create or replace function private.tfi_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.tfi_profiles p
    where p.user_id = (select auth.uid())
      and p.account_status = 'active'
  );
$function$;

create or replace function private.tfi_has_permission(
  p_module_key text,
  p_action_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.tfi_profiles p
    join public.tfi_user_roles ur on ur.user_id = p.user_id
    join public.tfi_roles r on r.id = ur.role_id
    join public.tfi_role_permissions rp on rp.role_id = r.id
    join public.tfi_permissions perm on perm.id = rp.permission_id
    where p.user_id = (select auth.uid())
      and p.account_status = 'active'
      and r.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and perm.module_key = p_module_key
      and perm.action_key = p_action_key
  );
$function$;

create or replace function private.tfi_get_my_access_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'profile',
    (
      select jsonb_build_object(
        'user_id',p.user_id,
        'email',p.email,
        'username',p.username,
        'display_name',p.display_name,
        'department',p.department,
        'account_status',p.account_status
      )
      from public.tfi_profiles p
      where p.user_id = (select auth.uid())
    ),
    'roles',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_key',r.role_key,
        'role_name',r.role_name
      ) order by r.role_name)
      from public.tfi_profiles p
      join public.tfi_user_roles ur on ur.user_id = p.user_id
      join public.tfi_roles r on r.id = ur.role_id
      where p.user_id = (select auth.uid())
        and p.account_status = 'active'
        and r.is_active = true
        and (ur.expires_at is null or ur.expires_at > now())
    ),'[]'::jsonb),
    'permissions',
    coalesce((
      select jsonb_agg(distinct perm.permission_key order by perm.permission_key)
      from public.tfi_profiles p
      join public.tfi_user_roles ur on ur.user_id = p.user_id
      join public.tfi_roles r on r.id = ur.role_id
      join public.tfi_role_permissions rp on rp.role_id = r.id
      join public.tfi_permissions perm on perm.id = rp.permission_id
      where p.user_id = (select auth.uid())
        and p.account_status = 'active'
        and r.is_active = true
        and (ur.expires_at is null or ur.expires_at > now())
    ),'[]'::jsonb)
  );
$function$;

revoke all on function private.tfi_is_active_user() from public,anon,authenticated;
revoke all on function private.tfi_has_permission(text,text) from public,anon,authenticated;
revoke all on function private.tfi_get_my_access_context() from public,anon,authenticated;
grant execute on function private.tfi_is_active_user() to authenticated;
grant execute on function private.tfi_has_permission(text,text) to authenticated;
grant execute on function private.tfi_get_my_access_context() to authenticated;

drop policy if exists tfi_modules_active_read on public.tfi_modules;
create policy tfi_modules_active_read
on public.tfi_modules for select to authenticated
using (private.tfi_is_active_user());

drop policy if exists tfi_profiles_self_or_admin_read on public.tfi_profiles;
create policy tfi_profiles_self_or_admin_read
on public.tfi_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or private.tfi_has_permission('users_access','view')
);

drop policy if exists tfi_roles_authorized_read on public.tfi_roles;
create policy tfi_roles_authorized_read
on public.tfi_roles for select to authenticated
using (private.tfi_has_permission('users_access','view'));

drop policy if exists tfi_permissions_access_admin_read on public.tfi_permissions;
create policy tfi_permissions_access_admin_read
on public.tfi_permissions for select to authenticated
using (private.tfi_has_permission('users_access','manage_access'));

drop policy if exists tfi_user_roles_self_or_admin_read on public.tfi_user_roles;
create policy tfi_user_roles_self_or_admin_read
on public.tfi_user_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or private.tfi_has_permission('users_access','view')
);

drop policy if exists tfi_role_permissions_admin_read on public.tfi_role_permissions;
create policy tfi_role_permissions_admin_read
on public.tfi_role_permissions for select to authenticated
using (private.tfi_has_permission('users_access','manage_access'));

drop policy if exists tfi_audit_events_authorized_read on public.tfi_audit_events;
create policy tfi_audit_events_authorized_read
on public.tfi_audit_events for select to authenticated
using (private.tfi_has_permission('audit_trail','view'));

drop policy if exists tfi_source_workbooks_active_read on public.tfi_source_workbooks;
create policy tfi_source_workbooks_active_read
on public.tfi_source_workbooks for select to authenticated
using (private.tfi_is_active_user());

drop policy if exists tfi_source_sheets_active_read on public.tfi_source_sheets;
create policy tfi_source_sheets_active_read
on public.tfi_source_sheets for select to authenticated
using (private.tfi_is_active_user());

create or replace function public.tfi_get_my_access_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.tfi_get_my_access_context();
$function$;

revoke all on function public.tfi_get_my_access_context() from public,anon;
grant execute on function public.tfi_get_my_access_context() to authenticated;

drop function if exists public.tfi_is_active_user();
drop function if exists public.tfi_has_permission(text,text);

create index if not exists tfi_roles_created_by_idx
  on public.tfi_roles (created_by) where created_by is not null;
create index if not exists tfi_user_roles_assigned_by_idx
  on public.tfi_user_roles (assigned_by) where assigned_by is not null;
create index if not exists tfi_role_permissions_permission_idx
  on public.tfi_role_permissions (permission_id);
create index if not exists tfi_role_permissions_granted_by_idx
  on public.tfi_role_permissions (granted_by) where granted_by is not null;

commit;