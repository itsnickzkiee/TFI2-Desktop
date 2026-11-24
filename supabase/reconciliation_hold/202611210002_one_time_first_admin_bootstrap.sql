-- TFI_NEW / TFI2 — Migration 005: one-time first administrator bootstrap.
-- The function is deliberately private and not executable by anon/authenticated users.
-- Create/invite the first Auth user through the Supabase Dashboard, then run this function
-- manually in the TFI2 SQL Editor using that user's Auth UUID.

begin;

create or replace function private.tfi_bootstrap_first_admin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role_id uuid;
  v_profile_status text;
  v_auth_user_count bigint;
  v_permission_count bigint;
  v_granted_permission_count bigint;
  v_user_email text;
begin
  if p_user_id is null then
    raise exception 'A valid first administrator user ID is required.'
      using errcode = '22023';
  end if;

  select count(*) into v_auth_user_count
  from auth.users;

  if v_auth_user_count <> 1 then
    raise exception 'First-admin bootstrap requires exactly one Auth user in TFI2; found %.',
      v_auth_user_count
      using errcode = '55000';
  end if;

  select u.email into v_user_email
  from auth.users u
  where u.id = p_user_id;

  if not found then
    raise exception 'The supplied user ID does not exist in TFI2 Auth.'
      using errcode = 'P0002';
  end if;

  select p.account_status into v_profile_status
  from public.tfi_profiles p
  where p.user_id = p_user_id
  for update;

  if not found then
    raise exception 'The Auth profile trigger has not created the TFI profile yet.'
      using errcode = '55000';
  end if;

  if v_profile_status = 'disabled' then
    raise exception 'A disabled TFI profile cannot be bootstrapped as administrator.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.tfi_user_roles ur
    join public.tfi_roles r on r.id = ur.role_id
    where r.role_key = 'system_admin'
  ) then
    raise exception 'A System Administrator assignment already exists; one-time bootstrap is closed.'
      using errcode = '55000';
  end if;

  select r.id into v_role_id
  from public.tfi_roles r
  where r.role_key = 'system_admin'
    and r.is_active = true;

  if v_role_id is null then
    raise exception 'The approved System Administrator role is not available.'
      using errcode = '55000';
  end if;

  select count(*) into v_permission_count
  from public.tfi_permissions;

  select count(*) into v_granted_permission_count
  from public.tfi_role_permissions rp
  where rp.role_id = v_role_id;

  if v_permission_count = 0 or v_granted_permission_count <> v_permission_count then
    raise exception 'System Administrator permission matrix is incomplete (% of %).',
      v_granted_permission_count,v_permission_count
      using errcode = '55000';
  end if;

  insert into public.tfi_user_roles (user_id,role_id,assigned_by,expires_at)
  values (p_user_id,v_role_id,null,null);

  update public.tfi_profiles
  set account_status = 'active',
      updated_at = now()
  where user_id = p_user_id;

  insert into public.tfi_audit_events (
    actor_user_id,
    actor_email_snapshot,
    actor_roles_snapshot,
    action_key,
    module_key,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  )
  values (
    null,
    null,
    '[]'::jsonb,
    'admin.bootstrap',
    'users_access',
    'tfi_profile',
    p_user_id::text,
    jsonb_build_object('account_status',v_profile_status),
    jsonb_build_object(
      'account_status','active',
      'role_key','system_admin',
      'role_name','System Administrator'
    ),
    jsonb_build_object(
      'bootstrap_type','one_time_first_admin',
      'email',v_user_email,
      'executed_at',now()
    )
  );

  return jsonb_build_object(
    'success',true,
    'user_id',p_user_id,
    'email',v_user_email,
    'account_status','active',
    'role_key','system_admin',
    'role_name','System Administrator',
    'permission_count',v_granted_permission_count
  );
end;
$function$;

revoke all on function private.tfi_bootstrap_first_admin(uuid)
  from public,anon,authenticated,service_role;

commit;