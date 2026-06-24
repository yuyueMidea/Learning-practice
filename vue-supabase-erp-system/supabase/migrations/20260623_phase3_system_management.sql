-- Phase 3 supplemental migration
-- Execute after erp_phase_1_supabase_schema.sql.
-- Adds the missing Permission Management menu and an explicit index for common user searches.

begin;

create index if not exists idx_sys_users_email_status on public.sys_users(email, status);
create index if not exists idx_sys_permissions_module_resource on public.sys_permissions(module, resource, sort_order);

insert into public.sys_menus (
  parent_id, code, name, menu_type, route_path, component_path, icon,
  permission_code, sort_order, is_visible, status
)
values (
  (select id from public.sys_menus where code = 'system'),
  'system-permissions', '权限管理', 'menu', '/system/permissions', 'system/PermissionManage',
  'Key', 'system:permission:read', 25, true, 'active'
)
on conflict (code) do update
set parent_id = excluded.parent_id,
    name = excluded.name,
    menu_type = excluded.menu_type,
    route_path = excluded.route_path,
    component_path = excluded.component_path,
    icon = excluded.icon,
    permission_code = excluded.permission_code,
    sort_order = excluded.sort_order,
    is_visible = excluded.is_visible,
    status = excluded.status;

commit;
