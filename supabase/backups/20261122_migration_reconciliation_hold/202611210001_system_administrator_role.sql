-- TFI_NEW / TFI2 — Migration 004: initial System Administrator role catalogue.
-- This seeds the approved role and its permissions only.
-- It does not create/invite an Auth user or assign the role to any person.

begin;

insert into public.tfi_roles
  (role_key,role_name,description,is_active)
values
  (
    'system_admin',
    'System Administrator',
    'Full administrative access across the TFI_NEW application modules, including user/access administration, configuration, import review, audit review, and operational workflows.',
    true
  )
on conflict (role_key) do nothing;

insert into public.tfi_role_permissions
  (role_id,permission_id)
select r.id,p.id
from public.tfi_roles r
cross join public.tfi_permissions p
where r.role_key = 'system_admin'
  and r.is_active = true
on conflict (role_id,permission_id) do nothing;

commit;