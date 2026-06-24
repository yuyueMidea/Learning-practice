-- ============================================================================
-- ERP for Supabase - Phase 1 (final corrected execution-safe edition)
-- PostgreSQL schema, indexes, RLS, triggers and test seed data
-- Run this script once in Supabase Dashboard > SQL Editor as a database owner.
-- Tested design target: Supabase PostgreSQL + Auth + RLS.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ============================================================================
-- 0. Common functions and access-control primitives
-- ============================================================================

create or replace function public.erp_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Maps every protected application table to the resource portion of a permission code.
-- Permission codes use this shape: <resource>:<action>, e.g. sales:order:read.
create or replace function public.erp_resource_for_table(p_table_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_table_name
    when 'sys_roles' then 'system:role'
    when 'sys_permissions' then 'system:permission'
    when 'sys_role_permissions' then 'system:role'
    when 'sys_user_roles' then 'system:user'
    when 'sys_menus' then 'system:menu'
    when 'sys_operation_logs' then 'system:log'

    when 'base_customers' then 'base:customer'
    when 'base_suppliers' then 'base:supplier'
    when 'base_warehouses' then 'base:warehouse'
    when 'base_warehouse_locations' then 'base:warehouse'
    when 'base_product_categories' then 'base:product_category'
    when 'base_products' then 'base:product'
    when 'base_product_units' then 'base:product_unit'
    when 'base_product_barcodes' then 'base:product'

    when 'pur_orders' then 'purchase:order'
    when 'pur_order_items' then 'purchase:order'
    when 'pur_receipts' then 'purchase:receipt'
    when 'pur_receipt_items' then 'purchase:receipt'
    when 'pur_returns' then 'purchase:return'
    when 'pur_return_items' then 'purchase:return'

    when 'sal_orders' then 'sales:order'
    when 'sal_order_items' then 'sales:order'
    when 'sal_deliveries' then 'sales:delivery'
    when 'sal_delivery_items' then 'sales:delivery'
    when 'sal_returns' then 'sales:return'
    when 'sal_return_items' then 'sales:return'

    when 'inv_stocks' then 'inventory:stock'
    when 'inv_transactions' then 'inventory:transaction'
    when 'inv_adjustments' then 'inventory:adjustment'
    when 'inv_adjustment_items' then 'inventory:adjustment'
    when 'inv_stocktakes' then 'inventory:stocktake'
    when 'inv_stocktake_items' then 'inventory:stocktake'
    when 'inv_transfers' then 'inventory:transfer'
    when 'inv_transfer_items' then 'inventory:transfer'

    when 'fin_receivables' then 'finance:receivable'
    when 'fin_payables' then 'finance:payable'
    when 'fin_receipts' then 'finance:receipt'
    when 'fin_payments' then 'finance:payment'
    when 'fin_expenses' then 'finance:expense'
    else null
  end;
$$;

-- ============================================================================
-- 1. System management
-- ============================================================================

create table if not exists public.sys_roles (
  id uuid primary key default gen_random_uuid(),
  code varchar(64) not null unique,
  name varchar(100) not null,
  description text,
  data_scope varchar(16) not null default 'all'
    check (data_scope in ('all', 'self')),
  is_system boolean not null default false,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.sys_permissions (
  id uuid primary key default gen_random_uuid(),
  code varchar(128) not null unique,
  name varchar(128) not null,
  module varchar(64) not null,
  resource varchar(64) not null,
  action varchar(32) not null
    check (action in ('read', 'create', 'update', 'delete', 'approve', 'export')),
  description text,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (resource, action)
);

-- sys_users intentionally has its own UUID primary key while auth_user_id is the
-- strict one-to-one reference to auth.users. This keeps every application table
-- compliant with the requested gen_random_uuid() primary-key convention.
create table if not exists public.sys_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  user_name varchar(80) not null unique,
  email varchar(255) not null unique,
  display_name varchar(120),
  avatar_path text,
  phone varchar(32),
  department_name varchar(120),
  job_title varchar(120),
  status varchar(16) not null default 'inactive'
    check (status in ('active', 'inactive', 'locked')),
  last_login_at timestamptz,
  last_login_ip inet,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.sys_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.sys_roles(id) on delete cascade,
  permission_id uuid not null references public.sys_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (role_id, permission_id)
);

create table if not exists public.sys_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.sys_users(id) on delete cascade,
  role_id uuid not null references public.sys_roles(id) on delete restrict,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (user_id, role_id)
);

create table if not exists public.sys_menus (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.sys_menus(id) on delete cascade,
  code varchar(100) not null unique,
  name varchar(100) not null,
  menu_type varchar(16) not null default 'menu'
    check (menu_type in ('directory', 'menu', 'button', 'external')),
  route_path varchar(255),
  component_path varchar(255),
  redirect_path varchar(255),
  icon varchar(100),
  permission_code varchar(128),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_visible boolean not null default true,
  is_cacheable boolean not null default false,
  is_affix boolean not null default false,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  check (
    (menu_type = 'button' and route_path is null)
    or menu_type <> 'button'
  )
);

create table if not exists public.sys_operation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.sys_users(id) on delete set null,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  module varchar(64) not null,
  operation varchar(64) not null,
  resource_type varchar(64),
  resource_id uuid,
  request_method varchar(12),
  request_path text,
  request_ip inet,
  user_agent text,
  request_payload jsonb,
  response_payload jsonb,
  status varchar(16) not null default 'success'
    check (status in ('success', 'failed')),
  error_message text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create index if not exists idx_sys_users_status on public.sys_users(status);
create index if not exists idx_sys_users_created_by on public.sys_users(created_by);
create index if not exists idx_sys_role_permissions_role on public.sys_role_permissions(role_id);
create index if not exists idx_sys_role_permissions_permission on public.sys_role_permissions(permission_id);
create index if not exists idx_sys_user_roles_user on public.sys_user_roles(user_id);
create index if not exists idx_sys_user_roles_role on public.sys_user_roles(role_id);
create index if not exists idx_sys_menus_parent_sort on public.sys_menus(parent_id, sort_order);
create index if not exists idx_sys_operation_logs_created_at on public.sys_operation_logs(created_at desc);
create index if not exists idx_sys_operation_logs_actor on public.sys_operation_logs(actor_auth_user_id, created_at desc);
create index if not exists idx_sys_operation_logs_resource on public.sys_operation_logs(resource_type, resource_id);

-- ============================================================================
-- 1.1 RBAC helper functions
-- These functions must be created AFTER the system tables above, because
-- PostgreSQL resolves referenced relations when creating LANGUAGE sql functions.
-- ============================================================================

-- Reads role assignments under SECURITY DEFINER so RLS policies do not recurse.
create or replace function public.erp_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.sys_users u
    join public.sys_user_roles ur on ur.user_id = u.id
      and ur.status = 'active'
      and (ur.expires_at is null or ur.expires_at > now())
    join public.sys_roles r on r.id = ur.role_id and r.status = 'active'
    where u.auth_user_id = auth.uid()
      and u.status = 'active'
      and r.code = 'SUPER_ADMIN'
  );
$$;

create or replace function public.erp_has_permission(p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select public.erp_is_super_admin()
      or exists (
        select 1
        from public.sys_users u
        join public.sys_user_roles ur on ur.user_id = u.id
          and ur.status = 'active'
          and (ur.expires_at is null or ur.expires_at > now())
        join public.sys_roles r on r.id = ur.role_id and r.status = 'active'
        join public.sys_role_permissions rp on rp.role_id = r.id
        join public.sys_permissions p on p.id = rp.permission_id and p.status = 'active'
        where u.auth_user_id = auth.uid()
          and u.status = 'active'
          and p.code = p_permission_code
      );
$$;

-- data_scope is enforced here. "all" means all rows of a resource; "self" means
-- rows created by the current authenticated user. A user may have multiple roles.
create or replace function public.erp_can_access(
  p_table_name text,
  p_action text,
  p_created_by uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_resource text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.erp_is_super_admin() then
    return true;
  end if;

  v_resource := public.erp_resource_for_table(p_table_name);
  if v_resource is null then
    return false;
  end if;

  return exists (
    select 1
    from public.sys_users u
    join public.sys_user_roles ur on ur.user_id = u.id
      and ur.status = 'active'
      and (ur.expires_at is null or ur.expires_at > now())
    join public.sys_roles r on r.id = ur.role_id and r.status = 'active'
    join public.sys_role_permissions rp on rp.role_id = r.id
    join public.sys_permissions p on p.id = rp.permission_id and p.status = 'active'
    where u.auth_user_id = auth.uid()
      and u.status = 'active'
      and p.code = v_resource || ':' || p_action
      and (
        r.data_scope = 'all'
        or (r.data_scope = 'self' and p_created_by = auth.uid())
      )
  );
end;
$$;

-- Prevent non-super-admins from silently rewriting audit ownership.
create or replace function public.erp_protect_created_by()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.created_by is distinct from old.created_by
     and not public.erp_is_super_admin() then
    raise exception 'created_by is immutable for non-super-admin users';
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 2. Base data
-- ============================================================================

create table if not exists public.base_customers (
  id uuid primary key default gen_random_uuid(),
  code varchar(64) not null unique,
  name varchar(200) not null,
  short_name varchar(100),
  customer_level varchar(16) not null default 'C'
    check (customer_level in ('VIP', 'A', 'B', 'C', 'D')),
  customer_type varchar(32) not null default 'company'
    check (customer_type in ('company', 'individual', 'internal')),
  tax_no varchar(64),
  contact_name varchar(100),
  contact_phone varchar(32),
  contact_email varchar(255),
  fax varchar(32),
  province varchar(64),
  city varchar(64),
  district varchar(64),
  address text,
  postal_code varchar(20),
  payment_term_days integer not null default 0 check (payment_term_days >= 0),
  credit_limit numeric(18,2) not null default 0 check (credit_limit >= 0),
  credit_used numeric(18,2) not null default 0 check (credit_used >= 0),
  price_level varchar(32) not null default 'standard',
  bank_name varchar(128),
  bank_account_name varchar(128),
  bank_account_no varchar(128),
  salesperson_user_id uuid references public.sys_users(id) on delete set null,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  remark text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.base_suppliers (
  id uuid primary key default gen_random_uuid(),
  code varchar(64) not null unique,
  name varchar(200) not null,
  short_name varchar(100),
  supplier_level varchar(16) not null default 'C'
    check (supplier_level in ('A', 'B', 'C', 'D')),
  supplier_type varchar(32) not null default 'manufacturer'
    check (supplier_type in ('manufacturer', 'distributor', 'service')),
  tax_no varchar(64),
  contact_name varchar(100),
  contact_phone varchar(32),
  contact_email varchar(255),
  fax varchar(32),
  province varchar(64),
  city varchar(64),
  district varchar(64),
  address text,
  postal_code varchar(20),
  payment_term_days integer not null default 0 check (payment_term_days >= 0),
  credit_limit numeric(18,2) not null default 0 check (credit_limit >= 0),
  bank_name varchar(128),
  bank_account_name varchar(128),
  bank_account_no varchar(128),
  purchaser_user_id uuid references public.sys_users(id) on delete set null,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  remark text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.base_warehouses (
  id uuid primary key default gen_random_uuid(),
  code varchar(64) not null unique,
  name varchar(120) not null,
  warehouse_type varchar(24) not null default 'normal'
    check (warehouse_type in ('normal', 'transit', 'returns', 'defective', 'virtual')),
  manager_user_id uuid references public.sys_users(id) on delete set null,
  contact_name varchar(100),
  contact_phone varchar(32),
  province varchar(64),
  city varchar(64),
  district varchar(64),
  address text,
  allow_negative_stock boolean not null default false,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  remark text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.base_warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.base_warehouses(id) on delete cascade,
  code varchar(64) not null,
  name varchar(120) not null,
  zone_code varchar(32),
  aisle_code varchar(32),
  shelf_code varchar(32),
  bin_code varchar(32),
  location_type varchar(24) not null default 'storage'
    check (location_type in ('receiving', 'storage', 'picking', 'shipping', 'returns', 'defective')),
  capacity_qty numeric(18,6) check (capacity_qty is null or capacity_qty >= 0),
  is_default boolean not null default false,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (warehouse_id, code)
);

create table if not exists public.base_product_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.base_product_categories(id) on delete restrict,
  code varchar(64) not null unique,
  name varchar(120) not null,
  icon varchar(100),
  sort_order integer not null default 0 check (sort_order >= 0),
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.base_product_units (
  id uuid primary key default gen_random_uuid(),
  code varchar(32) not null unique,
  name varchar(64) not null,
  decimal_places integer not null default 0 check (decimal_places between 0 and 6),
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.base_products (
  id uuid primary key default gen_random_uuid(),
  code varchar(64) not null unique,
  name varchar(200) not null,
  short_name varchar(100),
  category_id uuid references public.base_product_categories(id) on delete set null,
  base_unit_id uuid not null references public.base_product_units(id) on delete restrict,
  brand varchar(100),
  model varchar(100),
  specification text,
  origin varchar(100),
  primary_barcode varchar(128),
  sku_attributes jsonb not null default '{}'::jsonb,
  enable_batch boolean not null default false,
  enable_serial_no boolean not null default false,
  shelf_life_days integer check (shelf_life_days is null or shelf_life_days >= 0),
  purchase_price numeric(18,4) not null default 0 check (purchase_price >= 0),
  sale_price numeric(18,4) not null default 0 check (sale_price >= 0),
  min_sale_price numeric(18,4) not null default 0 check (min_sale_price >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate between 0 and 100),
  safety_stock numeric(18,6) not null default 0 check (safety_stock >= 0),
  min_stock numeric(18,6) not null default 0 check (min_stock >= 0),
  max_stock numeric(18,6) check (max_stock is null or max_stock >= min_stock),
  net_weight numeric(18,6) check (net_weight is null or net_weight >= 0),
  gross_weight numeric(18,6) check (gross_weight is null or gross_weight >= 0),
  image_path text,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  remark text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.base_product_barcodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.base_products(id) on delete cascade,
  unit_id uuid references public.base_product_units(id) on delete set null,
  barcode varchar(128) not null unique,
  conversion_rate numeric(18,6) not null default 1 check (conversion_rate > 0),
  is_primary boolean not null default false,
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create unique index if not exists uq_base_product_primary_barcode
  on public.base_products(primary_barcode)
  where primary_barcode is not null;
create index if not exists idx_base_customers_name on public.base_customers(name);
create index if not exists idx_base_customers_status_level on public.base_customers(status, customer_level);
create index if not exists idx_base_suppliers_name on public.base_suppliers(name);
create index if not exists idx_base_suppliers_status_level on public.base_suppliers(status, supplier_level);
create index if not exists idx_base_warehouse_locations_warehouse on public.base_warehouse_locations(warehouse_id, status);
create index if not exists idx_base_product_categories_parent_sort on public.base_product_categories(parent_id, sort_order);
create index if not exists idx_base_products_category_status on public.base_products(category_id, status);
create index if not exists idx_base_products_name on public.base_products(name);
create index if not exists idx_base_product_barcodes_product on public.base_product_barcodes(product_id);

-- ============================================================================
-- 3. Purchase management
-- ============================================================================

create table if not exists public.pur_orders (
  id uuid primary key default gen_random_uuid(),
  order_no varchar(64) not null unique,
  supplier_id uuid not null references public.base_suppliers(id) on delete restrict,
  warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  purchaser_user_id uuid references public.sys_users(id) on delete set null,
  order_date date not null default current_date,
  expected_arrival_date date,
  currency_code varchar(8) not null default 'CNY',
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  is_tax_included boolean not null default true,
  tax_rate numeric(7,4) not null default 0 check (tax_rate between 0 and 100),
  total_qty numeric(18,6) not null default 0 check (total_qty >= 0),
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  payable_amount numeric(18,2) not null default 0 check (payable_amount >= 0),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'partial_received', 'completed', 'closed', 'rejected')),
  source_type varchar(32) not null default 'manual',
  source_ref_no varchar(64),
  reviewer_user_id uuid references public.sys_users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  attachment_paths jsonb not null default '[]'::jsonb,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  check (expected_arrival_date is null or expected_arrival_date >= order_date)
);

create table if not exists public.pur_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pur_orders(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  product_id uuid not null references public.base_products(id) on delete restrict,
  unit_id uuid not null references public.base_product_units(id) on delete restrict,
  specification_snapshot text,
  qty numeric(18,6) not null check (qty > 0),
  received_qty numeric(18,6) not null default 0 check (received_qty >= 0 and received_qty <= qty),
  unit_price numeric(18,4) not null default 0 check (unit_price >= 0),
  discount_rate numeric(7,4) not null default 0 check (discount_rate between 0 and 100),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  amount_excl_tax numeric(18,2) not null default 0 check (amount_excl_tax >= 0),
  amount_incl_tax numeric(18,2) not null default 0 check (amount_incl_tax >= 0),
  expected_arrival_date date,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (order_id, line_no)
);

create table if not exists public.pur_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no varchar(64) not null unique,
  order_id uuid references public.pur_orders(id) on delete set null,
  supplier_id uuid not null references public.base_suppliers(id) on delete restrict,
  warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  receiver_user_id uuid references public.sys_users(id) on delete set null,
  receipt_date date not null default current_date,
  total_qty numeric(18,6) not null default 0 check (total_qty >= 0),
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'posted', 'cancelled')),
  posted_at timestamptz,
  attachment_paths jsonb not null default '[]'::jsonb,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.pur_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.pur_receipts(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  order_item_id uuid references public.pur_order_items(id) on delete set null,
  product_id uuid not null references public.base_products(id) on delete restrict,
  unit_id uuid not null references public.base_product_units(id) on delete restrict,
  location_id uuid references public.base_warehouse_locations(id) on delete set null,
  batch_no varchar(100),
  production_date date,
  expiry_date date,
  qty numeric(18,6) not null check (qty > 0),
  unit_price numeric(18,4) not null default 0 check (unit_price >= 0),
  amount numeric(18,2) not null default 0 check (amount >= 0),
  quality_status varchar(16) not null default 'qualified'
    check (quality_status in ('qualified', 'pending', 'rejected')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (receipt_id, line_no),
  check (expiry_date is null or production_date is null or expiry_date >= production_date)
);

create table if not exists public.pur_returns (
  id uuid primary key default gen_random_uuid(),
  return_no varchar(64) not null unique,
  receipt_id uuid references public.pur_receipts(id) on delete set null,
  supplier_id uuid not null references public.base_suppliers(id) on delete restrict,
  warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  return_date date not null default current_date,
  total_qty numeric(18,6) not null default 0 check (total_qty >= 0),
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  reason varchar(500),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'posted', 'cancelled')),
  reviewer_user_id uuid references public.sys_users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  attachment_paths jsonb not null default '[]'::jsonb,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.pur_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.pur_returns(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  receipt_item_id uuid references public.pur_receipt_items(id) on delete set null,
  product_id uuid not null references public.base_products(id) on delete restrict,
  unit_id uuid not null references public.base_product_units(id) on delete restrict,
  location_id uuid references public.base_warehouse_locations(id) on delete set null,
  batch_no varchar(100),
  qty numeric(18,6) not null check (qty > 0),
  unit_price numeric(18,4) not null default 0 check (unit_price >= 0),
  amount numeric(18,2) not null default 0 check (amount >= 0),
  reason varchar(500),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (return_id, line_no)
);

create index if not exists idx_pur_orders_supplier_date on public.pur_orders(supplier_id, order_date desc);
create index if not exists idx_pur_orders_warehouse_status on public.pur_orders(warehouse_id, status);
create index if not exists idx_pur_orders_status_created_at on public.pur_orders(status, created_at desc);
create index if not exists idx_pur_order_items_order on public.pur_order_items(order_id);
create index if not exists idx_pur_order_items_product on public.pur_order_items(product_id);
create index if not exists idx_pur_receipts_order on public.pur_receipts(order_id);
create index if not exists idx_pur_receipts_supplier_date on public.pur_receipts(supplier_id, receipt_date desc);
create index if not exists idx_pur_receipt_items_receipt on public.pur_receipt_items(receipt_id);
create index if not exists idx_pur_receipt_items_product_location on public.pur_receipt_items(product_id, location_id);
create index if not exists idx_pur_returns_supplier_date on public.pur_returns(supplier_id, return_date desc);
create index if not exists idx_pur_return_items_return on public.pur_return_items(return_id);

-- ============================================================================
-- 4. Sales management
-- ============================================================================

create table if not exists public.sal_orders (
  id uuid primary key default gen_random_uuid(),
  order_no varchar(64) not null unique,
  customer_id uuid not null references public.base_customers(id) on delete restrict,
  warehouse_id uuid references public.base_warehouses(id) on delete set null,
  salesperson_user_id uuid references public.sys_users(id) on delete set null,
  order_date date not null default current_date,
  delivery_date date,
  currency_code varchar(8) not null default 'CNY',
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  is_tax_included boolean not null default true,
  tax_rate numeric(7,4) not null default 0 check (tax_rate between 0 and 100),
  total_qty numeric(18,6) not null default 0 check (total_qty >= 0),
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  receivable_amount numeric(18,2) not null default 0 check (receivable_amount >= 0),
  credit_check_status varchar(24) not null default 'not_checked'
    check (credit_check_status in ('not_checked', 'passed', 'warning', 'blocked')),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'partial_delivered', 'completed', 'closed', 'rejected')),
  source_type varchar(32) not null default 'manual',
  source_ref_no varchar(64),
  reviewer_user_id uuid references public.sys_users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  attachment_paths jsonb not null default '[]'::jsonb,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  check (delivery_date is null or delivery_date >= order_date)
);

create table if not exists public.sal_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sal_orders(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  product_id uuid not null references public.base_products(id) on delete restrict,
  unit_id uuid not null references public.base_product_units(id) on delete restrict,
  specification_snapshot text,
  qty numeric(18,6) not null check (qty > 0),
  delivered_qty numeric(18,6) not null default 0 check (delivered_qty >= 0 and delivered_qty <= qty),
  unit_price numeric(18,4) not null default 0 check (unit_price >= 0),
  discount_rate numeric(7,4) not null default 0 check (discount_rate between 0 and 100),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  amount_excl_tax numeric(18,2) not null default 0 check (amount_excl_tax >= 0),
  amount_incl_tax numeric(18,2) not null default 0 check (amount_incl_tax >= 0),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (order_id, line_no)
);

create table if not exists public.sal_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_no varchar(64) not null unique,
  order_id uuid references public.sal_orders(id) on delete set null,
  customer_id uuid not null references public.base_customers(id) on delete restrict,
  warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  delivery_user_id uuid references public.sys_users(id) on delete set null,
  delivery_date date not null default current_date,
  receiver_name varchar(100),
  receiver_phone varchar(32),
  receiver_address text,
  logistics_company varchar(100),
  tracking_no varchar(100),
  total_qty numeric(18,6) not null default 0 check (total_qty >= 0),
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'posted', 'cancelled')),
  posted_at timestamptz,
  attachment_paths jsonb not null default '[]'::jsonb,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.sal_delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.sal_deliveries(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  order_item_id uuid references public.sal_order_items(id) on delete set null,
  product_id uuid not null references public.base_products(id) on delete restrict,
  unit_id uuid not null references public.base_product_units(id) on delete restrict,
  location_id uuid references public.base_warehouse_locations(id) on delete set null,
  batch_no varchar(100),
  qty numeric(18,6) not null check (qty > 0),
  unit_price numeric(18,4) not null default 0 check (unit_price >= 0),
  amount numeric(18,2) not null default 0 check (amount >= 0),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (delivery_id, line_no)
);

create table if not exists public.sal_returns (
  id uuid primary key default gen_random_uuid(),
  return_no varchar(64) not null unique,
  delivery_id uuid references public.sal_deliveries(id) on delete set null,
  customer_id uuid not null references public.base_customers(id) on delete restrict,
  warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  return_date date not null default current_date,
  total_qty numeric(18,6) not null default 0 check (total_qty >= 0),
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  reason varchar(500),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'posted', 'cancelled')),
  reviewer_user_id uuid references public.sys_users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  attachment_paths jsonb not null default '[]'::jsonb,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.sal_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sal_returns(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  delivery_item_id uuid references public.sal_delivery_items(id) on delete set null,
  product_id uuid not null references public.base_products(id) on delete restrict,
  unit_id uuid not null references public.base_product_units(id) on delete restrict,
  location_id uuid references public.base_warehouse_locations(id) on delete set null,
  batch_no varchar(100),
  qty numeric(18,6) not null check (qty > 0),
  unit_price numeric(18,4) not null default 0 check (unit_price >= 0),
  amount numeric(18,2) not null default 0 check (amount >= 0),
  quality_status varchar(16) not null default 'qualified'
    check (quality_status in ('qualified', 'pending', 'rejected')),
  reason varchar(500),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (return_id, line_no)
);

create index if not exists idx_sal_orders_customer_date on public.sal_orders(customer_id, order_date desc);
create index if not exists idx_sal_orders_status_created_at on public.sal_orders(status, created_at desc);
create index if not exists idx_sal_orders_salesperson on public.sal_orders(salesperson_user_id, status);
create index if not exists idx_sal_order_items_order on public.sal_order_items(order_id);
create index if not exists idx_sal_order_items_product on public.sal_order_items(product_id);
create index if not exists idx_sal_deliveries_order on public.sal_deliveries(order_id);
create index if not exists idx_sal_deliveries_customer_date on public.sal_deliveries(customer_id, delivery_date desc);
create index if not exists idx_sal_delivery_items_delivery on public.sal_delivery_items(delivery_id);
create index if not exists idx_sal_delivery_items_product_location on public.sal_delivery_items(product_id, location_id);
create index if not exists idx_sal_returns_customer_date on public.sal_returns(customer_id, return_date desc);
create index if not exists idx_sal_return_items_return on public.sal_return_items(return_id);

-- ============================================================================
-- 5. Inventory management
-- ============================================================================

create table if not exists public.inv_stocks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.base_products(id) on delete restrict,
  warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  location_id uuid references public.base_warehouse_locations(id) on delete restrict,
  batch_no varchar(100),
  production_date date,
  expiry_date date,
  quantity_on_hand numeric(18,6) not null default 0,
  quantity_reserved numeric(18,6) not null default 0 check (quantity_reserved >= 0),
  quantity_available numeric(18,6) not null default 0,
  unit_cost numeric(18,4) not null default 0 check (unit_cost >= 0),
  total_cost numeric(18,2) not null default 0,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  version_no bigint not null default 0 check (version_no >= 0),
  status varchar(16) not null default 'active'
    check (status in ('active', 'inactive')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  check (quantity_available = quantity_on_hand - quantity_reserved),
  check (expiry_date is null or production_date is null or expiry_date >= production_date)
);

create unique index if not exists uq_inv_stocks_dimension
  on public.inv_stocks (
    product_id,
    warehouse_id,
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(batch_no, '')
  );
create index if not exists idx_inv_stocks_product_warehouse on public.inv_stocks(product_id, warehouse_id);
create index if not exists idx_inv_stocks_warehouse_location on public.inv_stocks(warehouse_id, location_id);
create index if not exists idx_inv_stocks_expiry on public.inv_stocks(expiry_date) where expiry_date is not null;

create table if not exists public.inv_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_no varchar(64) not null unique,
  transaction_type varchar(32) not null
    check (transaction_type in (
      'purchase_receipt', 'purchase_return', 'sales_delivery', 'sales_return',
      'adjustment_gain', 'adjustment_loss', 'stocktake_gain', 'stocktake_loss',
      'transfer_out', 'transfer_in', 'opening_balance', 'reservation', 'release_reservation'
    )),
  direction varchar(8) not null check (direction in ('in', 'out', 'freeze', 'unfreeze')),
  transaction_at timestamptz not null default now(),
  product_id uuid not null references public.base_products(id) on delete restrict,
  warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  location_id uuid references public.base_warehouse_locations(id) on delete set null,
  batch_no varchar(100),
  stock_id uuid references public.inv_stocks(id) on delete set null,
  qty numeric(18,6) not null check (qty > 0),
  unit_cost numeric(18,4) not null default 0 check (unit_cost >= 0),
  amount numeric(18,2) not null default 0,
  before_qty numeric(18,6) not null default 0,
  after_qty numeric(18,6) not null default 0,
  source_type varchar(64),
  source_id uuid,
  source_no varchar(64),
  operator_user_id uuid references public.sys_users(id) on delete set null,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.inv_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_no varchar(64) not null unique,
  warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  adjustment_date date not null default current_date,
  adjustment_type varchar(16) not null check (adjustment_type in ('gain', 'loss')),
  reason varchar(500) not null,
  total_qty numeric(18,6) not null default 0 check (total_qty >= 0),
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'posted', 'cancelled')),
  reviewer_user_id uuid references public.sys_users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.inv_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.inv_adjustments(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  product_id uuid not null references public.base_products(id) on delete restrict,
  unit_id uuid not null references public.base_product_units(id) on delete restrict,
  location_id uuid references public.base_warehouse_locations(id) on delete set null,
  batch_no varchar(100),
  book_qty numeric(18,6) not null default 0,
  adjustment_qty numeric(18,6) not null check (adjustment_qty > 0),
  unit_cost numeric(18,4) not null default 0 check (unit_cost >= 0),
  amount numeric(18,2) not null default 0,
  reason varchar(500),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (adjustment_id, line_no)
);

create table if not exists public.inv_stocktakes (
  id uuid primary key default gen_random_uuid(),
  stocktake_no varchar(64) not null unique,
  warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  category_id uuid references public.base_product_categories(id) on delete set null,
  stocktake_date date not null default current_date,
  scope_type varchar(16) not null default 'warehouse'
    check (scope_type in ('warehouse', 'category', 'products')),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'in_progress', 'submitted', 'approved', 'posted', 'cancelled')),
  counter_user_id uuid references public.sys_users(id) on delete set null,
  reviewer_user_id uuid references public.sys_users(id) on delete set null,
  counted_at timestamptz,
  reviewed_at timestamptz,
  review_comment text,
  gain_amount numeric(18,2) not null default 0,
  loss_amount numeric(18,2) not null default 0,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.inv_stocktake_items (
  id uuid primary key default gen_random_uuid(),
  stocktake_id uuid not null references public.inv_stocktakes(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  product_id uuid not null references public.base_products(id) on delete restrict,
  unit_id uuid not null references public.base_product_units(id) on delete restrict,
  location_id uuid references public.base_warehouse_locations(id) on delete set null,
  batch_no varchar(100),
  book_qty numeric(18,6) not null default 0,
  actual_qty numeric(18,6),
  difference_qty numeric(18,6) generated always as (
    case when actual_qty is null then null else actual_qty - book_qty end
  ) stored,
  unit_cost numeric(18,4) not null default 0 check (unit_cost >= 0),
  difference_amount numeric(18,2) generated always as (
    case when actual_qty is null then null else round((actual_qty - book_qty) * unit_cost, 2) end
  ) stored,
  status varchar(16) not null default 'pending'
    check (status in ('pending', 'counted', 'approved', 'posted')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (stocktake_id, line_no)
);

create table if not exists public.inv_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no varchar(64) not null unique,
  from_warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  to_warehouse_id uuid not null references public.base_warehouses(id) on delete restrict,
  transfer_date date not null default current_date,
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'outbound_posted', 'in_transit', 'completed', 'cancelled')),
  outbound_user_id uuid references public.sys_users(id) on delete set null,
  inbound_user_id uuid references public.sys_users(id) on delete set null,
  reviewer_user_id uuid references public.sys_users(id) on delete set null,
  outbound_at timestamptz,
  inbound_at timestamptz,
  reviewed_at timestamptz,
  review_comment text,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  check (from_warehouse_id <> to_warehouse_id)
);

create table if not exists public.inv_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.inv_transfers(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  product_id uuid not null references public.base_products(id) on delete restrict,
  unit_id uuid not null references public.base_product_units(id) on delete restrict,
  from_location_id uuid references public.base_warehouse_locations(id) on delete set null,
  to_location_id uuid references public.base_warehouse_locations(id) on delete set null,
  batch_no varchar(100),
  qty numeric(18,6) not null check (qty > 0),
  outbound_qty numeric(18,6) not null default 0 check (outbound_qty >= 0 and outbound_qty <= qty),
  inbound_qty numeric(18,6) not null default 0 check (inbound_qty >= 0 and inbound_qty <= qty),
  unit_cost numeric(18,4) not null default 0 check (unit_cost >= 0),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (transfer_id, line_no)
);

create index if not exists idx_inv_transactions_product_time
  on public.inv_transactions(product_id, transaction_at desc);
create index if not exists idx_inv_transactions_warehouse_time
  on public.inv_transactions(warehouse_id, transaction_at desc);
create index if not exists idx_inv_transactions_source
  on public.inv_transactions(source_type, source_id);
create index if not exists idx_inv_adjustments_warehouse_status
  on public.inv_adjustments(warehouse_id, status, adjustment_date desc);
create index if not exists idx_inv_adjustment_items_adjustment
  on public.inv_adjustment_items(adjustment_id);
create index if not exists idx_inv_stocktakes_warehouse_status
  on public.inv_stocktakes(warehouse_id, status, stocktake_date desc);
create index if not exists idx_inv_stocktake_items_stocktake
  on public.inv_stocktake_items(stocktake_id);
create index if not exists idx_inv_transfers_status_date
  on public.inv_transfers(status, transfer_date desc);
create index if not exists idx_inv_transfers_warehouses
  on public.inv_transfers(from_warehouse_id, to_warehouse_id);
create index if not exists idx_inv_transfer_items_transfer
  on public.inv_transfer_items(transfer_id);

-- ============================================================================
-- 6. Finance management
-- ============================================================================

create table if not exists public.fin_receivables (
  id uuid primary key default gen_random_uuid(),
  receivable_no varchar(64) not null unique,
  customer_id uuid not null references public.base_customers(id) on delete restrict,
  source_type varchar(32) not null default 'sales_delivery',
  source_id uuid,
  source_no varchar(64),
  bill_date date not null default current_date,
  due_date date,
  original_amount numeric(18,2) not null check (original_amount >= 0),
  received_amount numeric(18,2) not null default 0 check (received_amount >= 0),
  outstanding_amount numeric(18,2) not null check (outstanding_amount >= 0),
  writeoff_amount numeric(18,2) not null default 0 check (writeoff_amount >= 0),
  status varchar(24) not null default 'open'
    check (status in ('open', 'partial', 'settled', 'overdue', 'written_off', 'cancelled')),
  salesperson_user_id uuid references public.sys_users(id) on delete set null,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  check (due_date is null or due_date >= bill_date),
  check (received_amount + writeoff_amount + outstanding_amount = original_amount)
);

create table if not exists public.fin_payables (
  id uuid primary key default gen_random_uuid(),
  payable_no varchar(64) not null unique,
  supplier_id uuid not null references public.base_suppliers(id) on delete restrict,
  source_type varchar(32) not null default 'purchase_receipt',
  source_id uuid,
  source_no varchar(64),
  bill_date date not null default current_date,
  due_date date,
  original_amount numeric(18,2) not null check (original_amount >= 0),
  paid_amount numeric(18,2) not null default 0 check (paid_amount >= 0),
  outstanding_amount numeric(18,2) not null check (outstanding_amount >= 0),
  writeoff_amount numeric(18,2) not null default 0 check (writeoff_amount >= 0),
  status varchar(24) not null default 'open'
    check (status in ('open', 'partial', 'settled', 'overdue', 'written_off', 'cancelled')),
  purchaser_user_id uuid references public.sys_users(id) on delete set null,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  check (due_date is null or due_date >= bill_date),
  check (paid_amount + writeoff_amount + outstanding_amount = original_amount)
);

create table if not exists public.fin_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no varchar(64) not null unique,
  customer_id uuid not null references public.base_customers(id) on delete restrict,
  receipt_date date not null default current_date,
  receipt_method varchar(24) not null
    check (receipt_method in ('cash', 'bank_transfer', 'cheque', 'wechat', 'alipay', 'other')),
  bank_account varchar(128),
  transaction_ref_no varchar(128),
  amount numeric(18,2) not null check (amount > 0),
  allocated_amount numeric(18,2) not null default 0 check (allocated_amount >= 0),
  unallocated_amount numeric(18,2) not null default 0 check (unallocated_amount >= 0),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'posted', 'cancelled')),
  handler_user_id uuid references public.sys_users(id) on delete set null,
  allocations jsonb not null default '[]'::jsonb,
  attachment_paths jsonb not null default '[]'::jsonb,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  check (allocated_amount + unallocated_amount = amount)
);

create table if not exists public.fin_payments (
  id uuid primary key default gen_random_uuid(),
  payment_no varchar(64) not null unique,
  supplier_id uuid not null references public.base_suppliers(id) on delete restrict,
  payment_date date not null default current_date,
  payment_method varchar(24) not null
    check (payment_method in ('cash', 'bank_transfer', 'cheque', 'wechat', 'alipay', 'other')),
  bank_account varchar(128),
  transaction_ref_no varchar(128),
  amount numeric(18,2) not null check (amount > 0),
  allocated_amount numeric(18,2) not null default 0 check (allocated_amount >= 0),
  unallocated_amount numeric(18,2) not null default 0 check (unallocated_amount >= 0),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'posted', 'cancelled')),
  handler_user_id uuid references public.sys_users(id) on delete set null,
  allocations jsonb not null default '[]'::jsonb,
  attachment_paths jsonb not null default '[]'::jsonb,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  check (allocated_amount + unallocated_amount = amount)
);

create table if not exists public.fin_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_no varchar(64) not null unique,
  expense_date date not null default current_date,
  expense_category varchar(100) not null,
  department_name varchar(120),
  payee_name varchar(200) not null,
  amount numeric(18,2) not null check (amount > 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  amount_excl_tax numeric(18,2) not null default 0 check (amount_excl_tax >= 0),
  payment_method varchar(24)
    check (payment_method is null or payment_method in ('cash', 'bank_transfer', 'cheque', 'wechat', 'alipay', 'other')),
  status varchar(24) not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'posted', 'rejected', 'cancelled')),
  applicant_user_id uuid references public.sys_users(id) on delete set null,
  reviewer_user_id uuid references public.sys_users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  attachment_paths jsonb not null default '[]'::jsonb,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create index if not exists idx_fin_receivables_customer_status_due
  on public.fin_receivables(customer_id, status, due_date);
create index if not exists idx_fin_receivables_status_due
  on public.fin_receivables(status, due_date);
create index if not exists idx_fin_payables_supplier_status_due
  on public.fin_payables(supplier_id, status, due_date);
create index if not exists idx_fin_payables_status_due
  on public.fin_payables(status, due_date);
create index if not exists idx_fin_receipts_customer_date
  on public.fin_receipts(customer_id, receipt_date desc);
create index if not exists idx_fin_payments_supplier_date
  on public.fin_payments(supplier_id, payment_date desc);
create index if not exists idx_fin_expenses_date_category
  on public.fin_expenses(expense_date desc, expense_category);
create index if not exists idx_fin_expenses_status
  on public.fin_expenses(status);

-- ============================================================================
-- 7. Auth profile synchronization and secure admin helper functions
-- ============================================================================

create or replace function public.erp_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_name text;
begin
  v_user_name := left(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'user'
    ),
    60
  ) || '_' || replace(left(new.id::text, 8), '-', '');

  insert into public.sys_users (
    auth_user_id, user_name, email, display_name, status, created_by
  )
  values (
    new.id,
    v_user_name,
    coalesce(new.email, new.id::text || '@unknown.local'),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'New user'), '@', 1)),
    'inactive',
    new.id
  )
  on conflict (auth_user_id)
  do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.sys_users.display_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_erp_auth_user_created on auth.users;
create trigger trg_erp_auth_user_created
after insert on auth.users
for each row execute function public.erp_handle_new_auth_user();

-- Backfill profiles for accounts created before this migration.
insert into public.sys_users (
  auth_user_id, user_name, email, display_name, status, created_by
)
select
  au.id,
  left(coalesce(nullif(au.raw_user_meta_data ->> 'user_name', ''), split_part(coalesce(au.email, 'user'), '@', 1)), 60)
    || '_' || replace(left(au.id::text, 8), '-', ''),
  coalesce(au.email, au.id::text || '@unknown.local'),
  coalesce(nullif(au.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(au.email, 'New user'), '@', 1)),
  'inactive',
  au.id
from auth.users au
on conflict (auth_user_id) do nothing;

-- Run this only from SQL Editor or a trusted server process. It is intentionally
-- NOT granted to "authenticated" users, so browsers cannot self-promote roles.
create or replace function public.erp_assign_role_to_auth_user(
  p_auth_user_id uuid,
  p_role_code text,
  p_activate boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
begin
  select id into v_user_id
  from public.sys_users
  where auth_user_id = p_auth_user_id;

  if v_user_id is null then
    raise exception 'No sys_users profile exists for auth user %', p_auth_user_id;
  end if;

  select id into v_role_id
  from public.sys_roles
  where code = p_role_code and status = 'active';

  if v_role_id is null then
    raise exception 'Active role % does not exist', p_role_code;
  end if;

  if p_activate then
    update public.sys_users
    set status = 'active'
    where id = v_user_id;
  end if;

  insert into public.sys_user_roles (user_id, role_id, status)
  values (v_user_id, v_role_id, 'active')
  on conflict (user_id, role_id)
  do update set status = 'active', expires_at = null;

  return v_user_id;
end;
$$;

-- Browser-facing auth payload. Frontend should call rpc('erp_get_my_authorization')
-- after Supabase Auth has restored a session instead of reading system tables directly.
create or replace function public.erp_get_my_authorization()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with current_profile as (
    select
      u.id,
      u.auth_user_id,
      u.user_name,
      u.email,
      u.display_name,
      u.avatar_path,
      u.phone,
      u.department_name,
      u.job_title,
      u.status
    from public.sys_users u
    where u.auth_user_id = auth.uid()
      and u.status = 'active'
  ),
  user_roles as (
    select r.id, r.code, r.name, r.data_scope
    from current_profile cu
    join public.sys_user_roles ur on ur.user_id = cu.id and ur.status = 'active'
    join public.sys_roles r on r.id = ur.role_id and r.status = 'active'
    where ur.expires_at is null or ur.expires_at > now()
  ),
  user_permissions as (
    select distinct p.code, p.name, p.module, p.resource, p.action
    from user_roles ur
    join public.sys_role_permissions rp on rp.role_id = ur.id
    join public.sys_permissions p on p.id = rp.permission_id and p.status = 'active'
  ),
  permitted_menus as (
    select m.*
    from public.sys_menus m
    where exists (select 1 from current_profile)
      and m.status = 'active'
      and m.is_visible = true
      and (
        m.permission_code is null
        or public.erp_has_permission(m.permission_code)
      )
  )
  select jsonb_build_object(
    'user', coalesce((select to_jsonb(cu) from current_profile cu), '{}'::jsonb),
    'roles', coalesce((select jsonb_agg(to_jsonb(ur) order by ur.code) from user_roles ur), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(to_jsonb(up) order by up.code) from user_permissions up), '[]'::jsonb),
    'menus', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pm.id,
          'parent_id', pm.parent_id,
          'code', pm.code,
          'name', pm.name,
          'menu_type', pm.menu_type,
          'route_path', pm.route_path,
          'component_path', pm.component_path,
          'redirect_path', pm.redirect_path,
          'icon', pm.icon,
          'permission_code', pm.permission_code,
          'sort_order', pm.sort_order,
          'is_cacheable', pm.is_cacheable,
          'is_affix', pm.is_affix,
          'meta', pm.meta
        )
        order by pm.sort_order, pm.code
      )
      from permitted_menus pm
    ), '[]'::jsonb)
  );
$$;

-- ============================================================================
-- 8. updated_at and created_by protection triggers for EVERY ERP table
-- ============================================================================

do $$
declare
  v_table text;
  v_tables text[] := array[
    'sys_roles', 'sys_permissions', 'sys_users', 'sys_role_permissions',
    'sys_user_roles', 'sys_menus', 'sys_operation_logs',
    'base_customers', 'base_suppliers', 'base_warehouses',
    'base_warehouse_locations', 'base_product_categories',
    'base_products', 'base_product_units', 'base_product_barcodes',
    'pur_orders', 'pur_order_items', 'pur_receipts', 'pur_receipt_items',
    'pur_returns', 'pur_return_items',
    'sal_orders', 'sal_order_items', 'sal_deliveries', 'sal_delivery_items',
    'sal_returns', 'sal_return_items',
    'inv_stocks', 'inv_transactions', 'inv_adjustments', 'inv_adjustment_items',
    'inv_stocktakes', 'inv_stocktake_items', 'inv_transfers', 'inv_transfer_items',
    'fin_receivables', 'fin_payables', 'fin_receipts', 'fin_payments', 'fin_expenses'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || v_table || '_updated_at', v_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.erp_set_updated_at()',
      'trg_' || v_table || '_updated_at', v_table
    );

    execute format('drop trigger if exists %I on public.%I', 'trg_' || v_table || '_protect_created_by', v_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.erp_protect_created_by()',
      'trg_' || v_table || '_protect_created_by', v_table
    );
  end loop;
end;
$$;

-- ============================================================================
-- 9. Row Level Security (RLS)
-- ============================================================================
-- Tables are reachable only by authenticated users; RLS then grants per-row access.
-- service_role is intentionally not mentioned in policies because it bypasses RLS.
-- The policy generator creates SELECT / INSERT / UPDATE / DELETE policies on every
-- application table except sys_users, which has tailored self-profile access below.

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.sys_users enable row level security;

drop policy if exists sys_users_select_self_or_authorized on public.sys_users;
create policy sys_users_select_self_or_authorized
on public.sys_users
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or public.erp_can_access('sys_user_roles', 'read', created_by)
);

drop policy if exists sys_users_insert_admin_only on public.sys_users;
create policy sys_users_insert_admin_only
on public.sys_users
for insert
to authenticated
with check (
  public.erp_is_super_admin()
  and public.erp_can_access('sys_user_roles', 'create', created_by)
);

drop policy if exists sys_users_update_admin_only on public.sys_users;
create policy sys_users_update_admin_only
on public.sys_users
for update
to authenticated
using (public.erp_can_access('sys_user_roles', 'update', created_by))
with check (public.erp_can_access('sys_user_roles', 'update', created_by));

drop policy if exists sys_users_delete_admin_only on public.sys_users;
create policy sys_users_delete_admin_only
on public.sys_users
for delete
to authenticated
using (public.erp_is_super_admin());

do $$
declare
  v_table text;
  v_tables text[] := array[
    'sys_roles', 'sys_permissions', 'sys_role_permissions', 'sys_user_roles',
    'sys_menus', 'sys_operation_logs',
    'base_customers', 'base_suppliers', 'base_warehouses',
    'base_warehouse_locations', 'base_product_categories',
    'base_products', 'base_product_units', 'base_product_barcodes',
    'pur_orders', 'pur_order_items', 'pur_receipts', 'pur_receipt_items',
    'pur_returns', 'pur_return_items',
    'sal_orders', 'sal_order_items', 'sal_deliveries', 'sal_delivery_items',
    'sal_returns', 'sal_return_items',
    'inv_stocks', 'inv_transactions', 'inv_adjustments', 'inv_adjustment_items',
    'inv_stocktakes', 'inv_stocktake_items', 'inv_transfers', 'inv_transfer_items',
    'fin_receivables', 'fin_payables', 'fin_receipts', 'fin_payments', 'fin_expenses'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('alter table public.%I enable row level security', v_table);

    execute format('drop policy if exists %I on public.%I', 'erp_' || v_table || '_select', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.erp_can_access(%L, %L, created_by))',
      'erp_' || v_table || '_select', v_table, v_table, 'read'
    );

    execute format('drop policy if exists %I on public.%I', 'erp_' || v_table || '_insert', v_table);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((public.erp_is_super_admin() or created_by = auth.uid()) and public.erp_can_access(%L, %L, created_by))',
      'erp_' || v_table || '_insert', v_table, v_table, 'create'
    );

    execute format('drop policy if exists %I on public.%I', 'erp_' || v_table || '_update', v_table);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.erp_can_access(%L, %L, created_by)) with check (public.erp_can_access(%L, %L, created_by))',
      'erp_' || v_table || '_update', v_table, v_table, 'update', v_table, 'update'
    );

    execute format('drop policy if exists %I on public.%I', 'erp_' || v_table || '_delete', v_table);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.erp_can_access(%L, %L, created_by))',
      'erp_' || v_table || '_delete', v_table, v_table, 'delete'
    );
  end loop;
end;
$$;

-- The authorization helper is the only browser-executable SECURITY DEFINER function.
revoke all on function public.erp_set_updated_at() from public;
revoke all on function public.erp_resource_for_table(text) from public;
revoke all on function public.erp_is_super_admin() from public;
revoke all on function public.erp_has_permission(text) from public;
revoke all on function public.erp_can_access(text, text, uuid) from public;
revoke all on function public.erp_protect_created_by() from public;
revoke all on function public.erp_handle_new_auth_user() from public;
revoke all on function public.erp_assign_role_to_auth_user(uuid, text, boolean) from public;
revoke all on function public.erp_get_my_authorization() from public;
-- These predicates are safe to expose: they return only access booleans and are
-- required at query time by RLS and Storage policies.
grant execute on function public.erp_is_super_admin() to authenticated;
grant execute on function public.erp_has_permission(text) to authenticated;
grant execute on function public.erp_can_access(text, text, uuid) to authenticated;
grant execute on function public.erp_get_my_authorization() to authenticated;

-- ============================================================================
-- 10. Supabase Storage bucket and Storage RLS for product images / attachments
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'erp-files',
  'erp-files',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists erp_files_select on storage.objects;
create policy erp_files_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'erp-files'
  and (
    public.erp_is_super_admin()
    or public.erp_has_permission('storage:read')
  )
);

drop policy if exists erp_files_insert on storage.objects;
create policy erp_files_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'erp-files'
  and (
    public.erp_is_super_admin()
    or public.erp_has_permission('storage:create')
  )
);

drop policy if exists erp_files_update on storage.objects;
create policy erp_files_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'erp-files'
  and (
    public.erp_is_super_admin()
    or public.erp_has_permission('storage:update')
  )
)
with check (
  bucket_id = 'erp-files'
  and (
    public.erp_is_super_admin()
    or public.erp_has_permission('storage:update')
  )
);

drop policy if exists erp_files_delete on storage.objects;
create policy erp_files_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'erp-files'
  and (
    public.erp_is_super_admin()
    or public.erp_has_permission('storage:delete')
  )
);

-- ============================================================================
-- 11. Seed data
-- ============================================================================

-- 11.1 Roles
insert into public.sys_roles (code, name, description, data_scope, is_system, status, sort_order)
values
  ('SUPER_ADMIN', '超级管理员', '拥有所有 ERP 数据与系统管理权限。', 'all', true, 'active', 1),
  ('ERP_MANAGER', 'ERP 管理员', '运营管理角色，可管理业务数据与审批。', 'all', true, 'active', 2),
  ('PURCHASER', '采购专员', '负责供应商、采购订单、收货及采购退货。', 'all', true, 'active', 10),
  ('SALES', '销售专员', '负责客户、销售订单、发货及销售退货。', 'all', true, 'active', 20),
  ('WAREHOUSE_KEEPER', '仓管员', '负责库存查询、收发、调整、盘点和调拨。', 'all', true, 'active', 30),
  ('FINANCE', '财务专员', '负责应收、应付、收付款和费用。', 'all', true, 'active', 40),
  ('VIEWER', '只读观察员', '仅可查看自己创建范围内已授权资源。', 'self', true, 'active', 99)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    data_scope = excluded.data_scope,
    is_system = excluded.is_system,
    status = excluded.status,
    sort_order = excluded.sort_order;

-- 11.2 All standard permissions. Resource keeps the <module>:<resource> shape.
with resources(module, resource, name) as (
  values
    ('system', 'system:role', '角色管理'),
    ('system', 'system:permission', '权限管理'),
    ('system', 'system:user', '用户管理'),
    ('system', 'system:menu', '菜单管理'),
    ('system', 'system:log', '操作日志'),
    ('base', 'base:customer', '客户档案'),
    ('base', 'base:supplier', '供应商档案'),
    ('base', 'base:warehouse', '仓库与库位'),
    ('base', 'base:product_category', '商品分类'),
    ('base', 'base:product', '商品档案'),
    ('base', 'base:product_unit', '计量单位'),
    ('purchase', 'purchase:order', '采购订单'),
    ('purchase', 'purchase:receipt', '采购收货'),
    ('purchase', 'purchase:return', '采购退货'),
    ('sales', 'sales:order', '销售订单'),
    ('sales', 'sales:delivery', '销售发货'),
    ('sales', 'sales:return', '销售退货'),
    ('inventory', 'inventory:stock', '库存查询'),
    ('inventory', 'inventory:transaction', '库存流水'),
    ('inventory', 'inventory:adjustment', '库存调整'),
    ('inventory', 'inventory:stocktake', '库存盘点'),
    ('inventory', 'inventory:transfer', '库存调拨'),
    ('finance', 'finance:receivable', '应收账款'),
    ('finance', 'finance:payable', '应付账款'),
    ('finance', 'finance:receipt', '收款单'),
    ('finance', 'finance:payment', '付款单'),
    ('finance', 'finance:expense', '费用单'),
    ('storage', 'storage', '附件与图片')
),
actions(action, action_name, sort_order) as (
  values
    ('read', '查看', 1),
    ('create', '新增', 2),
    ('update', '编辑', 3),
    ('delete', '删除', 4),
    ('approve', '审核', 5),
    ('export', '导出', 6)
)
insert into public.sys_permissions (code, name, module, resource, action, description, status, sort_order)
select
  r.resource || ':' || a.action,
  r.name || '-' || a.action_name,
  r.module,
  r.resource,
  a.action,
  r.name || a.action_name || '权限',
  'active',
  a.sort_order
from resources r
cross join actions a
on conflict (code) do update
set name = excluded.name,
    module = excluded.module,
    resource = excluded.resource,
    action = excluded.action,
    description = excluded.description,
    status = excluded.status,
    sort_order = excluded.sort_order;

-- 11.3 Role-to-permission test assignments
insert into public.sys_role_permissions (role_id, permission_id)
select r.id, p.id
from public.sys_roles r
cross join public.sys_permissions p
where r.code in ('SUPER_ADMIN', 'ERP_MANAGER')
on conflict (role_id, permission_id) do nothing;

insert into public.sys_role_permissions (role_id, permission_id)
select r.id, p.id
from public.sys_roles r
join public.sys_permissions p
  on p.resource in (
    'base:supplier', 'base:warehouse', 'base:product', 'base:product_category',
    'base:product_unit', 'purchase:order', 'purchase:receipt', 'purchase:return',
    'inventory:stock', 'inventory:transaction', 'storage'
  )
where r.code = 'PURCHASER'
  and p.action in ('read', 'create', 'update', 'approve', 'export')
on conflict (role_id, permission_id) do nothing;

insert into public.sys_role_permissions (role_id, permission_id)
select r.id, p.id
from public.sys_roles r
join public.sys_permissions p
  on p.resource in (
    'base:customer', 'base:warehouse', 'base:product', 'base:product_category',
    'base:product_unit', 'sales:order', 'sales:delivery', 'sales:return',
    'inventory:stock', 'inventory:transaction', 'finance:receivable', 'storage'
  )
where r.code = 'SALES'
  and p.action in ('read', 'create', 'update', 'approve', 'export')
on conflict (role_id, permission_id) do nothing;

insert into public.sys_role_permissions (role_id, permission_id)
select r.id, p.id
from public.sys_roles r
join public.sys_permissions p
  on p.resource in (
    'base:warehouse', 'base:product', 'base:product_category', 'base:product_unit',
    'inventory:stock', 'inventory:transaction', 'inventory:adjustment',
    'inventory:stocktake', 'inventory:transfer', 'purchase:receipt',
    'sales:delivery', 'purchase:return', 'sales:return', 'storage'
  )
where r.code = 'WAREHOUSE_KEEPER'
  and p.action in ('read', 'create', 'update', 'approve', 'export')
on conflict (role_id, permission_id) do nothing;

insert into public.sys_role_permissions (role_id, permission_id)
select r.id, p.id
from public.sys_roles r
join public.sys_permissions p
  on p.resource in (
    'base:customer', 'base:supplier', 'finance:receivable', 'finance:payable',
    'finance:receipt', 'finance:payment', 'finance:expense',
    'sales:order', 'sales:delivery', 'purchase:order', 'purchase:receipt',
    'storage'
  )
where r.code = 'FINANCE'
  and p.action in ('read', 'create', 'update', 'approve', 'export')
on conflict (role_id, permission_id) do nothing;

insert into public.sys_role_permissions (role_id, permission_id)
select r.id, p.id
from public.sys_roles r
join public.sys_permissions p on p.action = 'read'
where r.code = 'VIEWER'
on conflict (role_id, permission_id) do nothing;

-- 11.4 Menu tree
insert into public.sys_menus (
  code, name, menu_type, route_path, component_path, icon, sort_order, is_visible, status
)
values
  ('dashboard', '仪表盘', 'menu', '/dashboard', 'dashboard/DashboardView', 'Odometer', 1, true, 'active'),
  ('system', '系统管理', 'directory', '/system', null, 'Setting', 90, true, 'active'),
  ('base', '基础数据', 'directory', '/base', null, 'Files', 10, true, 'active'),
  ('purchase', '采购管理', 'directory', '/purchase', null, 'ShoppingCart', 20, true, 'active'),
  ('sales', '销售管理', 'directory', '/sales', null, 'Sell', 30, true, 'active'),
  ('inventory', '库存管理', 'directory', '/inventory', null, 'Box', 40, true, 'active'),
  ('finance', '财务管理', 'directory', '/finance', null, 'Money', 50, true, 'active'),
  ('report', '报表中心', 'directory', '/report', null, 'DataAnalysis', 60, true, 'active')
on conflict (code) do update
set name = excluded.name,
    menu_type = excluded.menu_type,
    route_path = excluded.route_path,
    component_path = excluded.component_path,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    is_visible = excluded.is_visible,
    status = excluded.status;

insert into public.sys_menus (
  parent_id, code, name, menu_type, route_path, component_path, icon,
  permission_code, sort_order, is_visible, status
)
values
  ((select id from public.sys_menus where code = 'system'), 'system-users', '用户管理', 'menu', '/system/users', 'system/UserManage', 'User', 'system:user:read', 10, true, 'active'),
  ((select id from public.sys_menus where code = 'system'), 'system-roles', '角色管理', 'menu', '/system/roles', 'system/RoleManage', 'UserFilled', 'system:role:read', 20, true, 'active'),
  ((select id from public.sys_menus where code = 'system'), 'system-menus', '菜单管理', 'menu', '/system/menus', 'system/MenuManage', 'Menu', 'system:menu:read', 30, true, 'active'),
  ((select id from public.sys_menus where code = 'system'), 'system-logs', '操作日志', 'menu', '/system/logs', 'system/OperationLog', 'Document', 'system:log:read', 40, true, 'active'),

  ((select id from public.sys_menus where code = 'base'), 'base-customers', '客户管理', 'menu', '/base/customers', 'base/CustomerManage', 'User', 'base:customer:read', 10, true, 'active'),
  ((select id from public.sys_menus where code = 'base'), 'base-suppliers', '供应商管理', 'menu', '/base/suppliers', 'base/SupplierManage', 'OfficeBuilding', 'base:supplier:read', 20, true, 'active'),
  ((select id from public.sys_menus where code = 'base'), 'base-warehouses', '仓库管理', 'menu', '/base/warehouses', 'base/WarehouseManage', 'House', 'base:warehouse:read', 30, true, 'active'),
  ((select id from public.sys_menus where code = 'base'), 'base-categories', '商品分类', 'menu', '/base/categories', 'base/ProductCategory', 'CollectionTag', 'base:product_category:read', 40, true, 'active'),
  ((select id from public.sys_menus where code = 'base'), 'base-products', '商品档案', 'menu', '/base/products', 'base/ProductManage', 'Goods', 'base:product:read', 50, true, 'active'),

  ((select id from public.sys_menus where code = 'purchase'), 'purchase-orders', '采购订单', 'menu', '/purchase/orders', 'purchase/PurchaseOrder', 'Tickets', 'purchase:order:read', 10, true, 'active'),
  ((select id from public.sys_menus where code = 'purchase'), 'purchase-receipts', '采购收货', 'menu', '/purchase/receipts', 'purchase/PurchaseReceipt', 'Download', 'purchase:receipt:read', 20, true, 'active'),
  ((select id from public.sys_menus where code = 'purchase'), 'purchase-returns', '采购退货', 'menu', '/purchase/returns', 'purchase/PurchaseReturn', 'RefreshLeft', 'purchase:return:read', 30, true, 'active'),
  ((select id from public.sys_menus where code = 'purchase'), 'purchase-statements', '采购对账', 'menu', '/purchase/statements', 'purchase/PurchaseStatement', 'DataLine', 'purchase:order:read', 40, true, 'active'),

  ((select id from public.sys_menus where code = 'sales'), 'sales-orders', '销售订单', 'menu', '/sales/orders', 'sales/SalesOrder', 'Tickets', 'sales:order:read', 10, true, 'active'),
  ((select id from public.sys_menus where code = 'sales'), 'sales-deliveries', '销售发货', 'menu', '/sales/deliveries', 'sales/SalesDelivery', 'Upload', 'sales:delivery:read', 20, true, 'active'),
  ((select id from public.sys_menus where code = 'sales'), 'sales-returns', '销售退货', 'menu', '/sales/returns', 'sales/SalesReturn', 'RefreshRight', 'sales:return:read', 30, true, 'active'),
  ((select id from public.sys_menus where code = 'sales'), 'sales-statements', '销售对账', 'menu', '/sales/statements', 'sales/SalesStatement', 'DataLine', 'sales:order:read', 40, true, 'active'),

  ((select id from public.sys_menus where code = 'inventory'), 'inventory-stock', '库存查询', 'menu', '/inventory/stocks', 'inventory/StockQuery', 'Search', 'inventory:stock:read', 10, true, 'active'),
  ((select id from public.sys_menus where code = 'inventory'), 'inventory-adjustments', '库存调整', 'menu', '/inventory/adjustments', 'inventory/StockAdjust', 'Operation', 'inventory:adjustment:read', 20, true, 'active'),
  ((select id from public.sys_menus where code = 'inventory'), 'inventory-stocktakes', '库存盘点', 'menu', '/inventory/stocktakes', 'inventory/StockTake', 'DocumentChecked', 'inventory:stocktake:read', 30, true, 'active'),
  ((select id from public.sys_menus where code = 'inventory'), 'inventory-transfers', '库存调拨', 'menu', '/inventory/transfers', 'inventory/StockTransfer', 'Connection', 'inventory:transfer:read', 40, true, 'active'),
  ((select id from public.sys_menus where code = 'inventory'), 'inventory-flows', '库存流水', 'menu', '/inventory/flows', 'inventory/StockFlow', 'Histogram', 'inventory:transaction:read', 50, true, 'active'),

  ((select id from public.sys_menus where code = 'finance'), 'finance-receivables', '应收账款', 'menu', '/finance/receivables', 'finance/Receivable', 'Wallet', 'finance:receivable:read', 10, true, 'active'),
  ((select id from public.sys_menus where code = 'finance'), 'finance-payables', '应付账款', 'menu', '/finance/payables', 'finance/Payable', 'CreditCard', 'finance:payable:read', 20, true, 'active'),
  ((select id from public.sys_menus where code = 'finance'), 'finance-receipts', '收款单', 'menu', '/finance/receipts', 'finance/ReceiptVoucher', 'Coin', 'finance:receipt:read', 30, true, 'active'),
  ((select id from public.sys_menus where code = 'finance'), 'finance-payments', '付款单', 'menu', '/finance/payments', 'finance/PaymentVoucher', 'Money', 'finance:payment:read', 40, true, 'active'),
  ((select id from public.sys_menus where code = 'finance'), 'finance-expenses', '费用单', 'menu', '/finance/expenses', 'finance/Expense', 'DocumentAdd', 'finance:expense:read', 50, true, 'active'),

  ((select id from public.sys_menus where code = 'report'), 'report-sales', '销售报表', 'menu', '/report/sales', 'report/SalesReport', 'TrendCharts', 'sales:order:read', 10, true, 'active'),
  ((select id from public.sys_menus where code = 'report'), 'report-purchase', '采购报表', 'menu', '/report/purchase', 'report/PurchaseReport', 'TrendCharts', 'purchase:order:read', 20, true, 'active'),
  ((select id from public.sys_menus where code = 'report'), 'report-inventory', '库存报表', 'menu', '/report/inventory', 'report/InventoryReport', 'PieChart', 'inventory:stock:read', 30, true, 'active'),
  ((select id from public.sys_menus where code = 'report'), 'report-finance', '财务报表', 'menu', '/report/finance', 'report/FinanceReport', 'DataAnalysis', 'finance:receivable:read', 40, true, 'active')
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

-- 11.5 Base data
insert into public.base_product_units (code, name, decimal_places, status)
values
  ('PCS', '个', 0, 'active'),
  ('BOX', '箱', 0, 'active'),
  ('KG', '千克', 3, 'active'),
  ('M', '米', 2, 'active')
on conflict (code) do update
set name = excluded.name, decimal_places = excluded.decimal_places, status = excluded.status;

insert into public.base_product_categories (code, name, icon, sort_order, status)
values
  ('OFFICE', '办公用品', 'Briefcase', 10, 'active'),
  ('ELECTRONICS', '电子产品', 'Monitor', 20, 'active'),
  ('PACKAGING', '包装耗材', 'Box', 30, 'active')
on conflict (code) do update
set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order, status = excluded.status;

insert into public.base_warehouses (
  code, name, warehouse_type, contact_name, contact_phone, province, city, district, address, status
)
values
  ('WH-MAIN', '总部主仓', 'normal', '仓库管理员', '13800000001', '广东省', '佛山市', '禅城区', '总部物流园 1 号', 'active'),
  ('WH-RETURN', '退货仓', 'returns', '退货管理员', '13800000002', '广东省', '佛山市', '禅城区', '总部物流园 2 号', 'active')
on conflict (code) do update
set name = excluded.name,
    warehouse_type = excluded.warehouse_type,
    contact_name = excluded.contact_name,
    contact_phone = excluded.contact_phone,
    province = excluded.province,
    city = excluded.city,
    district = excluded.district,
    address = excluded.address,
    status = excluded.status;

insert into public.base_warehouse_locations (
  warehouse_id, code, name, zone_code, aisle_code, shelf_code, bin_code, location_type, is_default, status
)
values
  ((select id from public.base_warehouses where code = 'WH-MAIN'), 'A-01-01', '主仓 A 区 01 排 01 位', 'A', '01', '01', '01', 'storage', true, 'active'),
  ((select id from public.base_warehouses where code = 'WH-MAIN'), 'A-01-02', '主仓 A 区 01 排 02 位', 'A', '01', '01', '02', 'storage', false, 'active'),
  ((select id from public.base_warehouses where code = 'WH-RETURN'), 'R-01-01', '退货仓 01 位', 'R', '01', '01', '01', 'returns', true, 'active')
on conflict (warehouse_id, code) do update
set name = excluded.name,
    zone_code = excluded.zone_code,
    aisle_code = excluded.aisle_code,
    shelf_code = excluded.shelf_code,
    bin_code = excluded.bin_code,
    location_type = excluded.location_type,
    is_default = excluded.is_default,
    status = excluded.status;

insert into public.base_customers (
  code, name, short_name, customer_level, customer_type, tax_no, contact_name, contact_phone,
  contact_email, province, city, district, address, payment_term_days, credit_limit, price_level, status, remark
)
values
  ('CUS-001', '佛山星辰科技有限公司', '星辰科技', 'A', 'company', '91440600TEST00001', '陈经理', '13900000001',
   'chen@example.com', '广东省', '佛山市', '南海区', '桂城街道科技路 88 号', 30, 50000.00, 'vip', 'active', '核心客户'),
  ('CUS-002', '广州启航贸易有限公司', '启航贸易', 'B', 'company', '91440100TEST00002', '李经理', '13900000002',
   'li@example.com', '广东省', '广州市', '天河区', '珠江新城商务大道 66 号', 15, 20000.00, 'standard', 'active', '常规客户')
on conflict (code) do update
set name = excluded.name,
    short_name = excluded.short_name,
    customer_level = excluded.customer_level,
    contact_name = excluded.contact_name,
    contact_phone = excluded.contact_phone,
    contact_email = excluded.contact_email,
    address = excluded.address,
    payment_term_days = excluded.payment_term_days,
    credit_limit = excluded.credit_limit,
    price_level = excluded.price_level,
    status = excluded.status,
    remark = excluded.remark;

insert into public.base_suppliers (
  code, name, short_name, supplier_level, supplier_type, tax_no, contact_name, contact_phone,
  contact_email, province, city, district, address, payment_term_days, credit_limit, status, remark
)
values
  ('SUP-001', '深圳优品供应链有限公司', '优品供应链', 'A', 'manufacturer', '91440300TEST00001', '王采购', '13700000001',
   'wang@example.com', '广东省', '深圳市', '宝安区', '供应链大道 100 号', 30, 100000.00, 'active', '主力供应商'),
  ('SUP-002', '东莞精工电子有限公司', '精工电子', 'B', 'manufacturer', '91441900TEST00002', '周小姐', '13700000002',
   'zhou@example.com', '广东省', '东莞市', '南城区', '科技产业园 8 栋', 45, 50000.00, 'active', '备用供应商')
on conflict (code) do update
set name = excluded.name,
    short_name = excluded.short_name,
    supplier_level = excluded.supplier_level,
    contact_name = excluded.contact_name,
    contact_phone = excluded.contact_phone,
    contact_email = excluded.contact_email,
    address = excluded.address,
    payment_term_days = excluded.payment_term_days,
    credit_limit = excluded.credit_limit,
    status = excluded.status,
    remark = excluded.remark;

insert into public.base_products (
  code, name, short_name, category_id, base_unit_id, brand, model, specification,
  primary_barcode, purchase_price, sale_price, min_sale_price, tax_rate, safety_stock, min_stock, max_stock, status, remark
)
values
  (
    'PRD-001',
    '无线蓝牙键盘',
    '蓝牙键盘',
    (select id from public.base_product_categories where code = 'ELECTRONICS'),
    (select id from public.base_product_units where code = 'PCS'),
    'ERP Demo',
    'KB-100',
    '87 键，蓝牙 5.0，黑色',
    '6900000000001',
    80.0000, 129.0000, 99.0000, 13.0000, 5.000000, 2.000000, 100.000000, 'active',
    '测试商品：可用于采购、销售、库存流程'
  ),
  (
    'PRD-002',
    'A4 复印纸',
    'A4 纸',
    (select id from public.base_product_categories where code = 'OFFICE'),
    (select id from public.base_product_units where code = 'BOX'),
    'ERP Demo',
    'PAPER-A4',
    '70g，500 张/包，5 包/箱',
    '6900000000002',
    95.0000, 138.0000, 110.0000, 13.0000, 10.000000, 5.000000, 200.000000, 'active',
    '测试商品：安全库存预警演示'
  )
on conflict (code) do update
set name = excluded.name,
    short_name = excluded.short_name,
    category_id = excluded.category_id,
    base_unit_id = excluded.base_unit_id,
    brand = excluded.brand,
    model = excluded.model,
    specification = excluded.specification,
    primary_barcode = excluded.primary_barcode,
    purchase_price = excluded.purchase_price,
    sale_price = excluded.sale_price,
    min_sale_price = excluded.min_sale_price,
    tax_rate = excluded.tax_rate,
    safety_stock = excluded.safety_stock,
    min_stock = excluded.min_stock,
    max_stock = excluded.max_stock,
    status = excluded.status,
    remark = excluded.remark;

insert into public.base_product_barcodes (
  product_id, unit_id, barcode, conversion_rate, is_primary, status
)
values
  (
    (select id from public.base_products where code = 'PRD-001'),
    (select id from public.base_product_units where code = 'PCS'),
    '6900000000001', 1, true, 'active'
  ),
  (
    (select id from public.base_products where code = 'PRD-002'),
    (select id from public.base_product_units where code = 'BOX'),
    '6900000000002', 1, true, 'active'
  )
on conflict (barcode) do update
set product_id = excluded.product_id,
    unit_id = excluded.unit_id,
    conversion_rate = excluded.conversion_rate,
    is_primary = excluded.is_primary,
    status = excluded.status;

-- 11.6 Sample purchase order, receipt, sales order and delivery
insert into public.pur_orders (
  order_no, supplier_id, warehouse_id, order_date, expected_arrival_date,
  total_qty, total_amount, discount_amount, tax_amount, payable_amount, status, remark
)
values (
  'PO202606230001',
  (select id from public.base_suppliers where code = 'SUP-001'),
  (select id from public.base_warehouses where code = 'WH-MAIN'),
  current_date - 5, current_date - 2,
  10.000000, 800.00, 0.00, 104.00, 904.00, 'completed', '测试采购订单'
)
on conflict (order_no) do update
set status = excluded.status,
    total_qty = excluded.total_qty,
    total_amount = excluded.total_amount,
    tax_amount = excluded.tax_amount,
    payable_amount = excluded.payable_amount,
    remark = excluded.remark;

insert into public.pur_order_items (
  order_id, line_no, product_id, unit_id, specification_snapshot, qty, received_qty,
  unit_price, discount_rate, discount_amount, tax_rate, tax_amount, amount_excl_tax, amount_incl_tax
)
values (
  (select id from public.pur_orders where order_no = 'PO202606230001'),
  1,
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_product_units where code = 'PCS'),
  '87 键，蓝牙 5.0，黑色',
  10.000000, 10.000000, 80.0000, 0, 0, 13.0000, 104.00, 800.00, 904.00
)
on conflict (order_id, line_no) do update
set qty = excluded.qty,
    received_qty = excluded.received_qty,
    unit_price = excluded.unit_price,
    tax_amount = excluded.tax_amount,
    amount_excl_tax = excluded.amount_excl_tax,
    amount_incl_tax = excluded.amount_incl_tax;

insert into public.pur_receipts (
  receipt_no, order_id, supplier_id, warehouse_id, receipt_date, total_qty, total_amount, status, posted_at, remark
)
values (
  'PR202606230001',
  (select id from public.pur_orders where order_no = 'PO202606230001'),
  (select id from public.base_suppliers where code = 'SUP-001'),
  (select id from public.base_warehouses where code = 'WH-MAIN'),
  current_date - 2, 10.000000, 904.00, 'posted', now() - interval '2 days', '测试采购收货单'
)
on conflict (receipt_no) do update
set status = excluded.status,
    total_qty = excluded.total_qty,
    total_amount = excluded.total_amount,
    posted_at = excluded.posted_at,
    remark = excluded.remark;

insert into public.pur_receipt_items (
  receipt_id, line_no, order_item_id, product_id, unit_id, location_id, qty, unit_price, amount, quality_status, remark
)
values (
  (select id from public.pur_receipts where receipt_no = 'PR202606230001'),
  1,
  (select poi.id from public.pur_order_items poi join public.pur_orders po on po.id = poi.order_id where po.order_no = 'PO202606230001' and poi.line_no = 1),
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_product_units where code = 'PCS'),
  (select id from public.base_warehouse_locations where code = 'A-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
  10.000000, 80.0000, 800.00, 'qualified', '测试收货明细'
)
on conflict (receipt_id, line_no) do update
set qty = excluded.qty, unit_price = excluded.unit_price, amount = excluded.amount, quality_status = excluded.quality_status;

insert into public.sal_orders (
  order_no, customer_id, warehouse_id, order_date, delivery_date,
  total_qty, total_amount, discount_amount, tax_amount, receivable_amount,
  credit_check_status, status, remark
)
values (
  'SO202606230001',
  (select id from public.base_customers where code = 'CUS-001'),
  (select id from public.base_warehouses where code = 'WH-MAIN'),
  current_date - 1, current_date,
  3.000000, 387.00, 0.00, 50.31, 437.31,
  'passed', 'completed', '测试销售订单'
)
on conflict (order_no) do update
set status = excluded.status,
    total_qty = excluded.total_qty,
    total_amount = excluded.total_amount,
    tax_amount = excluded.tax_amount,
    receivable_amount = excluded.receivable_amount,
    credit_check_status = excluded.credit_check_status,
    remark = excluded.remark;

insert into public.sal_order_items (
  order_id, line_no, product_id, unit_id, specification_snapshot, qty, delivered_qty,
  unit_price, discount_rate, discount_amount, tax_rate, tax_amount, amount_excl_tax, amount_incl_tax
)
values (
  (select id from public.sal_orders where order_no = 'SO202606230001'),
  1,
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_product_units where code = 'PCS'),
  '87 键，蓝牙 5.0，黑色',
  3.000000, 3.000000, 129.0000, 0, 0, 13.0000, 50.31, 387.00, 437.31
)
on conflict (order_id, line_no) do update
set qty = excluded.qty,
    delivered_qty = excluded.delivered_qty,
    unit_price = excluded.unit_price,
    tax_amount = excluded.tax_amount,
    amount_excl_tax = excluded.amount_excl_tax,
    amount_incl_tax = excluded.amount_incl_tax;

insert into public.sal_deliveries (
  delivery_no, order_id, customer_id, warehouse_id, delivery_date,
  receiver_name, receiver_phone, receiver_address, total_qty, total_amount, status, posted_at, remark
)
values (
  'SD202606230001',
  (select id from public.sal_orders where order_no = 'SO202606230001'),
  (select id from public.base_customers where code = 'CUS-001'),
  (select id from public.base_warehouses where code = 'WH-MAIN'),
  current_date,
  '陈经理', '13900000001', '桂城街道科技路 88 号', 3.000000, 437.31, 'posted', now(), '测试销售发货单'
)
on conflict (delivery_no) do update
set status = excluded.status,
    total_qty = excluded.total_qty,
    total_amount = excluded.total_amount,
    posted_at = excluded.posted_at,
    remark = excluded.remark;

insert into public.sal_delivery_items (
  delivery_id, line_no, order_item_id, product_id, unit_id, location_id, qty, unit_price, amount, remark
)
values (
  (select id from public.sal_deliveries where delivery_no = 'SD202606230001'),
  1,
  (select soi.id from public.sal_order_items soi join public.sal_orders so on so.id = soi.order_id where so.order_no = 'SO202606230001' and soi.line_no = 1),
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_product_units where code = 'PCS'),
  (select id from public.base_warehouse_locations where code = 'A-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
  3.000000, 129.0000, 387.00, '测试发货明细'
)
on conflict (delivery_id, line_no) do update
set qty = excluded.qty, unit_price = excluded.unit_price, amount = excluded.amount;

-- 11.7 Draft return, adjustment, stocktake and transfer records
insert into public.pur_returns (
  return_no, receipt_id, supplier_id, warehouse_id, return_date, total_qty, total_amount, reason, status, remark
)
values (
  'PVR202606230001',
  (select id from public.pur_receipts where receipt_no = 'PR202606230001'),
  (select id from public.base_suppliers where code = 'SUP-001'),
  (select id from public.base_warehouses where code = 'WH-MAIN'),
  current_date, 1.000000, 80.00, '外观轻微损伤', 'draft', '测试采购退货单'
)
on conflict (return_no) do update
set total_qty = excluded.total_qty, total_amount = excluded.total_amount, reason = excluded.reason, status = excluded.status;

insert into public.pur_return_items (
  return_id, line_no, receipt_item_id, product_id, unit_id, location_id, qty, unit_price, amount, reason
)
values (
  (select id from public.pur_returns where return_no = 'PVR202606230001'),
  1,
  (select pri.id from public.pur_receipt_items pri join public.pur_receipts pr on pr.id = pri.receipt_id where pr.receipt_no = 'PR202606230001' and pri.line_no = 1),
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_product_units where code = 'PCS'),
  (select id from public.base_warehouse_locations where code = 'A-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
  1.000000, 80.0000, 80.00, '外观轻微损伤'
)
on conflict (return_id, line_no) do update
set qty = excluded.qty, unit_price = excluded.unit_price, amount = excluded.amount, reason = excluded.reason;

insert into public.sal_returns (
  return_no, delivery_id, customer_id, warehouse_id, return_date, total_qty, total_amount, reason, status, remark
)
values (
  'SVR202606230001',
  (select id from public.sal_deliveries where delivery_no = 'SD202606230001'),
  (select id from public.base_customers where code = 'CUS-001'),
  (select id from public.base_warehouses where code = 'WH-RETURN'),
  current_date, 1.000000, 129.00, '客户申请退货', 'draft', '测试销售退货单'
)
on conflict (return_no) do update
set total_qty = excluded.total_qty, total_amount = excluded.total_amount, reason = excluded.reason, status = excluded.status;

insert into public.sal_return_items (
  return_id, line_no, delivery_item_id, product_id, unit_id, location_id, qty, unit_price, amount, quality_status, reason
)
values (
  (select id from public.sal_returns where return_no = 'SVR202606230001'),
  1,
  (select sdi.id from public.sal_delivery_items sdi join public.sal_deliveries sd on sd.id = sdi.delivery_id where sd.delivery_no = 'SD202606230001' and sdi.line_no = 1),
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_product_units where code = 'PCS'),
  (select id from public.base_warehouse_locations where code = 'R-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-RETURN')),
  1.000000, 129.0000, 129.00, 'pending', '客户申请退货'
)
on conflict (return_id, line_no) do update
set qty = excluded.qty, unit_price = excluded.unit_price, amount = excluded.amount, quality_status = excluded.quality_status, reason = excluded.reason;

insert into public.inv_adjustments (
  adjustment_no, warehouse_id, adjustment_date, adjustment_type, reason, total_qty, total_amount, status, remark
)
values (
  'IA202606230001',
  (select id from public.base_warehouses where code = 'WH-MAIN'),
  current_date, 'loss', '破损报废', 1.000000, 80.00, 'draft', '测试库存调整单'
)
on conflict (adjustment_no) do update
set adjustment_type = excluded.adjustment_type, reason = excluded.reason, total_qty = excluded.total_qty, total_amount = excluded.total_amount, status = excluded.status;

insert into public.inv_adjustment_items (
  adjustment_id, line_no, product_id, unit_id, location_id, book_qty, adjustment_qty, unit_cost, amount, reason
)
values (
  (select id from public.inv_adjustments where adjustment_no = 'IA202606230001'),
  1,
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_product_units where code = 'PCS'),
  (select id from public.base_warehouse_locations where code = 'A-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
  7.000000, 1.000000, 80.0000, 80.00, '破损报废'
)
on conflict (adjustment_id, line_no) do update
set book_qty = excluded.book_qty, adjustment_qty = excluded.adjustment_qty, unit_cost = excluded.unit_cost, amount = excluded.amount, reason = excluded.reason;

insert into public.inv_stocktakes (
  stocktake_no, warehouse_id, category_id, stocktake_date, scope_type, status, remark
)
values (
  'ST202606230001',
  (select id from public.base_warehouses where code = 'WH-MAIN'),
  (select id from public.base_product_categories where code = 'ELECTRONICS'),
  current_date, 'category', 'draft', '测试库存盘点单'
)
on conflict (stocktake_no) do update
set category_id = excluded.category_id, stocktake_date = excluded.stocktake_date, scope_type = excluded.scope_type, status = excluded.status, remark = excluded.remark;

insert into public.inv_stocktake_items (
  stocktake_id, line_no, product_id, unit_id, location_id, book_qty, actual_qty, unit_cost, status, remark
)
values (
  (select id from public.inv_stocktakes where stocktake_no = 'ST202606230001'),
  1,
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_product_units where code = 'PCS'),
  (select id from public.base_warehouse_locations where code = 'A-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
  7.000000, null, 80.0000, 'pending', '等待盘点'
)
on conflict (stocktake_id, line_no) do update
set book_qty = excluded.book_qty, actual_qty = excluded.actual_qty, unit_cost = excluded.unit_cost, status = excluded.status, remark = excluded.remark;

insert into public.inv_transfers (
  transfer_no, from_warehouse_id, to_warehouse_id, transfer_date, status, remark
)
values (
  'IT202606230001',
  (select id from public.base_warehouses where code = 'WH-MAIN'),
  (select id from public.base_warehouses where code = 'WH-RETURN'),
  current_date, 'draft', '测试库存调拨单'
)
on conflict (transfer_no) do update
set transfer_date = excluded.transfer_date, status = excluded.status, remark = excluded.remark;

insert into public.inv_transfer_items (
  transfer_id, line_no, product_id, unit_id, from_location_id, to_location_id, qty, unit_cost, remark
)
values (
  (select id from public.inv_transfers where transfer_no = 'IT202606230001'),
  1,
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_product_units where code = 'PCS'),
  (select id from public.base_warehouse_locations where code = 'A-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
  (select id from public.base_warehouse_locations where code = 'R-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-RETURN')),
  1.000000, 80.0000, '测试库存调拨明细'
)
on conflict (transfer_id, line_no) do update
set qty = excluded.qty, unit_cost = excluded.unit_cost, remark = excluded.remark;

-- 11.8 Inventory balance and transaction trace for posted documents
insert into public.inv_stocks (
  product_id, warehouse_id, location_id, quantity_on_hand, quantity_reserved,
  quantity_available, unit_cost, total_cost, last_inbound_at, last_outbound_at, status, remark
)
values (
  (select id from public.base_products where code = 'PRD-001'),
  (select id from public.base_warehouses where code = 'WH-MAIN'),
  (select id from public.base_warehouse_locations where code = 'A-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
  7.000000, 0.000000, 7.000000, 80.0000, 560.00,
  now() - interval '2 days', now(), 'active', '收货 10 个、发货 3 个后的测试库存'
)
on conflict (
  product_id,
  warehouse_id,
  (coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  (coalesce(batch_no, ''))
) do update
set quantity_on_hand = excluded.quantity_on_hand,
    quantity_reserved = excluded.quantity_reserved,
    quantity_available = excluded.quantity_available,
    unit_cost = excluded.unit_cost,
    total_cost = excluded.total_cost,
    last_inbound_at = excluded.last_inbound_at,
    last_outbound_at = excluded.last_outbound_at,
    status = excluded.status,
    remark = excluded.remark;

insert into public.inv_transactions (
  transaction_no, transaction_type, direction, transaction_at, product_id, warehouse_id,
  location_id, stock_id, qty, unit_cost, amount, before_qty, after_qty,
  source_type, source_id, source_no, remark
)
values
  (
    'ITX202606210001', 'purchase_receipt', 'in', now() - interval '2 days',
    (select id from public.base_products where code = 'PRD-001'),
    (select id from public.base_warehouses where code = 'WH-MAIN'),
    (select id from public.base_warehouse_locations where code = 'A-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
    (select s.id from public.inv_stocks s join public.base_products p on p.id = s.product_id where p.code = 'PRD-001' and s.warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
    10.000000, 80.0000, 800.00, 0.000000, 10.000000,
    'pur_receipts', (select id from public.pur_receipts where receipt_no = 'PR202606230001'), 'PR202606230001', '采购收货入库'
  ),
  (
    'ITX202606230001', 'sales_delivery', 'out', now(),
    (select id from public.base_products where code = 'PRD-001'),
    (select id from public.base_warehouses where code = 'WH-MAIN'),
    (select id from public.base_warehouse_locations where code = 'A-01-01' and warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
    (select s.id from public.inv_stocks s join public.base_products p on p.id = s.product_id where p.code = 'PRD-001' and s.warehouse_id = (select id from public.base_warehouses where code = 'WH-MAIN')),
    3.000000, 80.0000, 240.00, 10.000000, 7.000000,
    'sal_deliveries', (select id from public.sal_deliveries where delivery_no = 'SD202606230001'), 'SD202606230001', '销售发货出库'
  )
on conflict (transaction_no) do update
set transaction_type = excluded.transaction_type,
    direction = excluded.direction,
    transaction_at = excluded.transaction_at,
    qty = excluded.qty,
    unit_cost = excluded.unit_cost,
    amount = excluded.amount,
    before_qty = excluded.before_qty,
    after_qty = excluded.after_qty,
    source_type = excluded.source_type,
    source_id = excluded.source_id,
    source_no = excluded.source_no,
    remark = excluded.remark;

-- 11.9 Financial testing records
insert into public.fin_receivables (
  receivable_no, customer_id, source_type, source_id, source_no, bill_date, due_date,
  original_amount, received_amount, outstanding_amount, writeoff_amount, status, remark
)
values (
  'AR202606230001',
  (select id from public.base_customers where code = 'CUS-001'),
  'sales_delivery',
  (select id from public.sal_deliveries where delivery_no = 'SD202606230001'),
  'SD202606230001',
  current_date, current_date + 30,
  437.31, 100.00, 337.31, 0.00, 'partial', '测试应收账款'
)
on conflict (receivable_no) do update
set original_amount = excluded.original_amount,
    received_amount = excluded.received_amount,
    outstanding_amount = excluded.outstanding_amount,
    writeoff_amount = excluded.writeoff_amount,
    status = excluded.status,
    remark = excluded.remark;

insert into public.fin_payables (
  payable_no, supplier_id, source_type, source_id, source_no, bill_date, due_date,
  original_amount, paid_amount, outstanding_amount, writeoff_amount, status, remark
)
values (
  'AP202606230001',
  (select id from public.base_suppliers where code = 'SUP-001'),
  'purchase_receipt',
  (select id from public.pur_receipts where receipt_no = 'PR202606230001'),
  'PR202606230001',
  current_date - 2, current_date + 28,
  904.00, 300.00, 604.00, 0.00, 'partial', '测试应付账款'
)
on conflict (payable_no) do update
set original_amount = excluded.original_amount,
    paid_amount = excluded.paid_amount,
    outstanding_amount = excluded.outstanding_amount,
    writeoff_amount = excluded.writeoff_amount,
    status = excluded.status,
    remark = excluded.remark;

insert into public.fin_receipts (
  receipt_no, customer_id, receipt_date, receipt_method, bank_account, transaction_ref_no,
  amount, allocated_amount, unallocated_amount, status, allocations, remark
)
values (
  'RV202606230001',
  (select id from public.base_customers where code = 'CUS-001'),
  current_date, 'bank_transfer', '中国银行-企业基本户', 'BANK-RECEIPT-001',
  100.00, 100.00, 0.00, 'posted',
  jsonb_build_array(jsonb_build_object('receivable_no', 'AR202606230001', 'amount', 100.00)),
  '测试收款单'
)
on conflict (receipt_no) do update
set amount = excluded.amount,
    allocated_amount = excluded.allocated_amount,
    unallocated_amount = excluded.unallocated_amount,
    status = excluded.status,
    allocations = excluded.allocations,
    remark = excluded.remark;

insert into public.fin_payments (
  payment_no, supplier_id, payment_date, payment_method, bank_account, transaction_ref_no,
  amount, allocated_amount, unallocated_amount, status, allocations, remark
)
values (
  'PV202606230001',
  (select id from public.base_suppliers where code = 'SUP-001'),
  current_date, 'bank_transfer', '中国银行-企业基本户', 'BANK-PAYMENT-001',
  300.00, 300.00, 0.00, 'posted',
  jsonb_build_array(jsonb_build_object('payable_no', 'AP202606230001', 'amount', 300.00)),
  '测试付款单'
)
on conflict (payment_no) do update
set amount = excluded.amount,
    allocated_amount = excluded.allocated_amount,
    unallocated_amount = excluded.unallocated_amount,
    status = excluded.status,
    allocations = excluded.allocations,
    remark = excluded.remark;

insert into public.fin_expenses (
  expense_no, expense_date, expense_category, department_name, payee_name,
  amount, tax_rate, tax_amount, amount_excl_tax, payment_method, status, remark
)
values (
  'EX202606230001', current_date, '办公费用', '行政部', '佛山市办公用品商行',
  500.00, 0.00, 0.00, 500.00, 'bank_transfer', 'draft', '测试费用单'
)
on conflict (expense_no) do update
set expense_date = excluded.expense_date,
    expense_category = excluded.expense_category,
    department_name = excluded.department_name,
    payee_name = excluded.payee_name,
    amount = excluded.amount,
    tax_rate = excluded.tax_rate,
    tax_amount = excluded.tax_amount,
    amount_excl_tax = excluded.amount_excl_tax,
    payment_method = excluded.payment_method,
    status = excluded.status,
    remark = excluded.remark;

insert into public.sys_operation_logs (
  module, operation, resource_type, request_method, request_path, request_payload,
  response_payload, status, duration_ms, created_by
)
values (
  'system', 'seed', 'database', 'SQL', '/seed', '{"source":"phase-1"}'::jsonb,
  '{"result":"success"}'::jsonb, 'success', 0, null
)
on conflict do nothing;

-- ============================================================================
-- 12. Initial super-admin setup
-- ============================================================================
-- 1) In Supabase Dashboard > Authentication > Users, create your first email user.
-- 2) Copy that user's UUID and execute the following statement separately:
--
-- select public.erp_assign_role_to_auth_user(
--   'REPLACE_WITH_AUTH_USERS_ID'::uuid,
--   'SUPER_ADMIN',
--   true
-- );
--
-- New signups are intentionally created as "inactive" until an administrator
-- activates them and assigns at least one role.

commit;
