-- TFI_NEW / TFI2 — Migration 001: identity, access-control foundation, and module catalog.
-- Additive only. No users, roles, operational records, or sample transactions are created.
-- TFI2 is the only target project. Do not apply this migration to the legacy TFI project.

begin;

create table if not exists public.tfi_modules (
  module_key text primary key
    check (module_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  display_name text not null check (length(display_name) between 1 and 120),
  module_group text not null check (module_group in (
    'operations','monitoring','reports','master_data','import','administration'
  )),
  route_key text not null unique,
  is_operational boolean not null default false,
  is_importable boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.tfi_modules is
  'Static TFI_NEW application module registry. Catalog metadata only; not operational data.';

insert into public.tfi_modules
  (module_key,display_name,module_group,route_key,is_operational,is_importable,sort_order)
values
  ('dashboard','Dashboard','monitoring','Dashboard',false,false,10),
  ('product_entry','Product Entry','operations','Product Entry',true,true,20),
  ('production_entry','Production Entry','operations','Production Entry',true,true,30),
  ('production_schedule','Production Schedule','operations','Production Schedule',true,true,40),
  ('dmp_production','DMP Production','operations','DMP Production',true,true,50),
  ('dmr_production','DMR Production','operations','DMR Production',true,true,60),
  ('dmr_coding','DMR Coding','operations','DMR Coding',true,true,70),
  ('hourly_meat','Hourly Meat','operations','Hourly Meat',true,true,80),
  ('hourly_coding','Hourly Coding','operations','Hourly Coding',true,true,90),
  ('hourly_agri','Hourly Agri','operations','Hourly Agri',true,true,100),
  ('oee','OEE','monitoring','OEE',true,true,110),
  ('productivity','Productivity','monitoring','Productivity',true,true,120),
  ('yield_monitoring','Yield Monitoring','monitoring','Yield Monitoring',false,false,130),
  ('coding_dpr','Coding DPR','operations','Coding DPR',true,true,140),
  ('pr_monitoring','PR Monitoring','operations','PR Monitoring',true,true,150),
  ('co_qa','CO QA','operations','CO QA',true,true,160),
  ('nonprod','NON-PROD','operations','NON-PROD',true,true,170),
  ('reports_reconciliation','Reports & Reconciliation','reports','Reports & Reconciliation',false,false,180),
  ('master_data','Master Data','master_data','Master Data',false,false,190),
  ('spreadsheet_import','Spreadsheet Import Center','import','Spreadsheet Import',false,false,200),
  ('import_history','Import History','import','Import History',false,false,210),
  ('import_inbox','Central Import Inbox','import','Central Import Inbox',false,false,220),
  ('duplicate_review','Duplicate Review','import','Duplicate Review',false,false,230),
  ('import_confirmation','Import Confirmation','import','Import Confirmation',false,false,240),
  ('users_access','Users & Access','administration','Users & Access',false,false,250),
  ('session_management','Session Management','administration','Session Management',false,false,260),
  ('security_activity','Security & Activity','administration','Security & Activity',false,false,270),
  ('security_alert_rules','Security Alert Rules & Notifications','administration','Security Alert Rules & Notifications',false,false,280),
  ('audit_trail','Audit Trail','administration','Audit Trail',false,false,290),
  ('system_settings','System Settings','administration','Settings',false,false,300)
on conflict (module_key) do nothing;

create table if not exists public.tfi_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  display_name text,
  department text,
  account_status text not null default 'pending'
    check (account_status in ('pending','active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tfi_profiles_username_format check (
    username is null or username ~ '^[A-Za-z0-9._-]{3,40}$'
  )
);

create unique index if not exists tfi_profiles_email_lower_uidx
  on public.tfi_profiles (lower(email)) where email is not null;
create unique index if not exists tfi_profiles_username_lower_uidx
  on public.tfi_profiles (lower(username)) where username is not null;

comment on table public.tfi_profiles is
  'Application profile linked one-to-one with Supabase Auth. New profiles default to pending and receive no access automatically.';

create table if not exists public.tfi_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique
    check (role_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  role_name text not null unique check (length(role_name) between 1 and 100),
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tfi_roles is
  'Approved application roles. Intentionally empty until the owner approves the role catalogue.';

create table if not exists public.tfi_permissions (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.tfi_modules(module_key) on delete restrict,
  action_key text not null
    check (action_key in (
      'view','create','edit','submit','review','approve',
      'export','import','manage_access','configure','archive','restore'
    )),
  permission_key text not null unique,
  display_label text not null,
  created_at timestamptz not null default now(),
  unique (module_key,action_key)
);

comment on table public.tfi_permissions is
  'Permission catalogue only. These permissions are not granted until an approved role is configured.';

insert into public.tfi_permissions (module_key,action_key,permission_key,display_label)
select m.module_key, a.action_key,
       m.module_key || '.' || a.action_key,
       initcap(replace(a.action_key,'_',' ')) || ' — ' || m.display_name
from public.tfi_modules m
cross join (values
  ('view'),('create'),('edit'),('submit'),('review'),('approve'),
  ('export'),('import'),('manage_access'),('configure'),('archive'),('restore')
) as a(action_key)
on conflict (module_key,action_key) do nothing;

create table if not exists public.tfi_user_roles (
  user_id uuid not null references public.tfi_profiles(user_id) on delete cascade,
  role_id uuid not null references public.tfi_roles(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id,role_id),
  constraint tfi_user_roles_expiry check (
    expires_at is null or expires_at > assigned_at
  )
);

create index if not exists tfi_user_roles_role_idx
  on public.tfi_user_roles (role_id,user_id);

create table if not exists public.tfi_role_permissions (
  role_id uuid not null references public.tfi_roles(id) on delete cascade,
  permission_id uuid not null references public.tfi_permissions(id) on delete restrict,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (role_id,permission_id)
);

create table if not exists public.tfi_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email_snapshot text,
  actor_roles_snapshot jsonb not null default '[]'::jsonb
    check (jsonb_typeof(actor_roles_snapshot) = 'array'),
  action_key text not null check (length(action_key) between 1 and 100),
  module_key text references public.tfi_modules(module_key) on delete restrict,
  entity_type text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  request_id uuid,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index if not exists tfi_audit_events_recent_idx
  on public.tfi_audit_events (occurred_at desc,id desc);
create index if not exists tfi_audit_events_module_idx
  on public.tfi_audit_events (module_key,occurred_at desc);
create index if not exists tfi_audit_events_actor_idx
  on public.tfi_audit_events (actor_user_id,occurred_at desc);

comment on table public.tfi_audit_events is
  'Append-only application audit event store. Client-side direct writes are not granted.';

create or replace function public.tfi_is_active_user()
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

create or replace function public.tfi_has_permission(
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
    join public.tfi_user_roles ur
      on ur.user_id = p.user_id
    join public.tfi_roles r
      on r.id = ur.role_id
    join public.tfi_role_permissions rp
      on rp.role_id = r.id
    join public.tfi_permissions perm
      on perm.id = rp.permission_id
    where p.user_id = (select auth.uid())
      and p.account_status = 'active'
      and r.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and perm.module_key = p_module_key
      and perm.action_key = p_action_key
  );
$function$;

create or replace function public.tfi_get_my_access_context()
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
      from public.tfi_user_roles ur
      join public.tfi_roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.is_active = true
        and (ur.expires_at is null or ur.expires_at > now())
    ),'[]'::jsonb),
    'permissions',
    coalesce((
      select jsonb_agg(distinct perm.permission_key order by perm.permission_key)
      from public.tfi_user_roles ur
      join public.tfi_roles r on r.id = ur.role_id
      join public.tfi_role_permissions rp on rp.role_id = r.id
      join public.tfi_permissions perm on perm.id = rp.permission_id
      where ur.user_id = (select auth.uid())
        and r.is_active = true
        and (ur.expires_at is null or ur.expires_at > now())
    ),'[]'::jsonb)
  );
$function$;

create or replace function public.tfi_handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.tfi_profiles (
    user_id,email,display_name,account_status
  )
  values (
    new.id,
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'),''),
    'pending'
  )
  on conflict (user_id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$function$;

drop trigger if exists tfi_auth_user_profile_sync on auth.users;
create trigger tfi_auth_user_profile_sync
after insert or update of email on auth.users
for each row execute function public.tfi_handle_auth_user_change();

alter table public.tfi_modules enable row level security;
alter table public.tfi_profiles enable row level security;
alter table public.tfi_roles enable row level security;
alter table public.tfi_permissions enable row level security;
alter table public.tfi_user_roles enable row level security;
alter table public.tfi_role_permissions enable row level security;
alter table public.tfi_audit_events enable row level security;

drop policy if exists tfi_modules_active_read on public.tfi_modules;
create policy tfi_modules_active_read
on public.tfi_modules for select to authenticated
using (public.tfi_is_active_user());

drop policy if exists tfi_profiles_self_or_admin_read on public.tfi_profiles;
create policy tfi_profiles_self_or_admin_read
on public.tfi_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.tfi_has_permission('users_access','view')
);

drop policy if exists tfi_roles_authorized_read on public.tfi_roles;
create policy tfi_roles_authorized_read
on public.tfi_roles for select to authenticated
using (public.tfi_has_permission('users_access','view'));

drop policy if exists tfi_permissions_access_admin_read on public.tfi_permissions;
create policy tfi_permissions_access_admin_read
on public.tfi_permissions for select to authenticated
using (public.tfi_has_permission('users_access','manage_access'));

drop policy if exists tfi_user_roles_self_or_admin_read on public.tfi_user_roles;
create policy tfi_user_roles_self_or_admin_read
on public.tfi_user_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.tfi_has_permission('users_access','view')
);

drop policy if exists tfi_role_permissions_admin_read on public.tfi_role_permissions;
create policy tfi_role_permissions_admin_read
on public.tfi_role_permissions for select to authenticated
using (public.tfi_has_permission('users_access','manage_access'));

drop policy if exists tfi_audit_events_authorized_read on public.tfi_audit_events;
create policy tfi_audit_events_authorized_read
on public.tfi_audit_events for select to authenticated
using (public.tfi_has_permission('audit_trail','view'));

revoke all on public.tfi_modules,public.tfi_profiles,public.tfi_roles,
  public.tfi_permissions,public.tfi_user_roles,public.tfi_role_permissions,
  public.tfi_audit_events
from public,anon,authenticated;

grant select on public.tfi_modules,public.tfi_profiles,public.tfi_roles,
  public.tfi_permissions,public.tfi_user_roles,public.tfi_role_permissions,
  public.tfi_audit_events to authenticated;

revoke all on function public.tfi_is_active_user() from public,anon;
revoke all on function public.tfi_has_permission(text,text) from public,anon;
revoke all on function public.tfi_get_my_access_context() from public,anon;
grant execute on function public.tfi_is_active_user() to authenticated;
grant execute on function public.tfi_has_permission(text,text) to authenticated;
grant execute on function public.tfi_get_my_access_context() to authenticated;

revoke all on function public.tfi_handle_auth_user_change() from public,anon,authenticated;

commit;