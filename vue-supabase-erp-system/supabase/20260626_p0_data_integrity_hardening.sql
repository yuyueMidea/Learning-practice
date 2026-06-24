-- ============================================================================
-- ERP P0 Data Integrity Hardening Migration
-- Target baseline:
--   1) erp_phase_1_supabase_schema_final.sql
--   2) 20260623_phase3_system_management.sql
--   3) 20260624_phase5_7_inventory_workflows.sql
--   4) 20260625_phase8_9_finance_reporting.sql
--
-- What this migration changes
--   A. Correct future inventory transaction costing (COGS uses stock cost, not sale price).
--   B. Add immutable posted-document and protected-ledger guards.
--   C. Add customer credit notes / supplier debit notes for return financial closure.
--   D. Move credit-limit, return-quantity and source-document validation into database posting.
--
-- Important:
--   * This is forward-only. It does NOT recalculate historical inventory transaction costs.
--   * Test in a Supabase branch/project before production use.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Preconditions
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.inv_stocks') is null
     or to_regclass('public.fin_receivables') is null
     or to_regprocedure('public.erp_post_inventory(text,uuid)') is null
     or to_regprocedure('public.erp_post_receipt(uuid)') is null then
    raise exception
      'Missing ERP baseline. Run Phase 1, Phase 5-7 and Phase 8-9 migrations first.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Return financial closure: credit/debit balances and note tables
-- ---------------------------------------------------------------------------
alter table public.fin_receivables
  add column if not exists credit_amount numeric(18,2) not null default 0
  check (credit_amount >= 0);

alter table public.fin_payables
  add column if not exists debit_amount numeric(18,2) not null default 0
  check (debit_amount >= 0);

-- Replace the original accounting-balance checks so customer credits / supplier
-- debits are treated as a formal settlement method instead of a write-off.
do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.fin_receivables'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%received_amount%'
      and pg_get_constraintdef(oid) ilike '%writeoff_amount%'
      and pg_get_constraintdef(oid) ilike '%outstanding_amount%'
      and pg_get_constraintdef(oid) ilike '%original_amount%'
  loop
    execute format('alter table public.fin_receivables drop constraint %I', v_constraint);
  end loop;

  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.fin_payables'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%paid_amount%'
      and pg_get_constraintdef(oid) ilike '%writeoff_amount%'
      and pg_get_constraintdef(oid) ilike '%outstanding_amount%'
      and pg_get_constraintdef(oid) ilike '%original_amount%'
  loop
    execute format('alter table public.fin_payables drop constraint %I', v_constraint);
  end loop;
end;
$$;

alter table public.fin_receivables
  drop constraint if exists chk_fin_receivables_balance_v2,
  add constraint chk_fin_receivables_balance_v2
    check (received_amount + writeoff_amount + credit_amount + outstanding_amount = original_amount);

alter table public.fin_payables
  drop constraint if exists chk_fin_payables_balance_v2,
  add constraint chk_fin_payables_balance_v2
    check (paid_amount + writeoff_amount + debit_amount + outstanding_amount = original_amount);

create table if not exists public.fin_customer_credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_note_no varchar(64) not null unique,
  customer_id uuid not null references public.base_customers(id) on delete restrict,
  source_type varchar(32) not null default 'sales_return',
  source_id uuid not null,
  source_no varchar(64),
  note_date date not null default current_date,
  original_amount numeric(18,2) not null check (original_amount > 0),
  applied_amount numeric(18,2) not null default 0 check (applied_amount >= 0),
  unapplied_amount numeric(18,2) not null check (unapplied_amount >= 0),
  status varchar(24) not null default 'open'
    check (status in ('open', 'partial', 'applied', 'cancelled')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (source_type, source_id),
  check (applied_amount + unapplied_amount = original_amount)
);

create table if not exists public.fin_supplier_debit_notes (
  id uuid primary key default gen_random_uuid(),
  debit_note_no varchar(64) not null unique,
  supplier_id uuid not null references public.base_suppliers(id) on delete restrict,
  source_type varchar(32) not null default 'purchase_return',
  source_id uuid not null,
  source_no varchar(64),
  note_date date not null default current_date,
  original_amount numeric(18,2) not null check (original_amount > 0),
  applied_amount numeric(18,2) not null default 0 check (applied_amount >= 0),
  unapplied_amount numeric(18,2) not null check (unapplied_amount >= 0),
  status varchar(24) not null default 'open'
    check (status in ('open', 'partial', 'applied', 'cancelled')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (source_type, source_id),
  check (applied_amount + unapplied_amount = original_amount)
);

create table if not exists public.fin_receivable_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.fin_customer_credit_notes(id) on delete restrict,
  receivable_id uuid not null references public.fin_receivables(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  applied_at timestamptz not null default now(),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (credit_note_id, receivable_id)
);

create table if not exists public.fin_payable_debit_allocations (
  id uuid primary key default gen_random_uuid(),
  debit_note_id uuid not null references public.fin_supplier_debit_notes(id) on delete restrict,
  payable_id uuid not null references public.fin_payables(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  applied_at timestamptz not null default now(),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (debit_note_id, payable_id)
);

create index if not exists idx_fin_customer_credit_notes_customer_status
  on public.fin_customer_credit_notes(customer_id, status, note_date desc);
create index if not exists idx_fin_supplier_debit_notes_supplier_status
  on public.fin_supplier_debit_notes(supplier_id, status, note_date desc);
create index if not exists idx_fin_receivable_credit_allocations_receivable
  on public.fin_receivable_credit_allocations(receivable_id);
create index if not exists idx_fin_payable_debit_allocations_payable
  on public.fin_payable_debit_allocations(payable_id);

-- Makes future stock transactions traceable to a precise source line. The column
-- remains nullable for historic rows created before this migration.
alter table public.inv_transactions
  add column if not exists source_item_id uuid;

create index if not exists idx_inv_transactions_source_item
  on public.inv_transactions(source_type, source_id, source_item_id);
create index if not exists idx_pur_return_items_receipt_item
  on public.pur_return_items(receipt_item_id);
create index if not exists idx_sal_return_items_delivery_item
  on public.sal_return_items(delivery_item_id);

-- ---------------------------------------------------------------------------
-- 2. Permissions, grants and RLS for new credit/debit tables
-- ---------------------------------------------------------------------------
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
    when 'fin_receivable_credit_allocations' then 'finance:receivable'
    when 'fin_customer_credit_notes' then 'finance:receivable'
    when 'fin_payables' then 'finance:payable'
    when 'fin_payable_debit_allocations' then 'finance:payable'
    when 'fin_supplier_debit_notes' then 'finance:payable'
    when 'fin_receipts' then 'finance:receipt'
    when 'fin_payments' then 'finance:payment'
    when 'fin_expenses' then 'finance:expense'
    else null
  end;
$$;

-- Existing baseline granted DML broadly to authenticated. Ledger tables must be
-- query-only from the browser; SECURITY DEFINER posting functions remain able to write.
revoke insert, update, delete on table public.inv_stocks from authenticated;
revoke insert, update, delete on table public.inv_transactions from authenticated;
revoke insert, update, delete on table public.fin_receivables from authenticated;
revoke insert, update, delete on table public.fin_payables from authenticated;

revoke all on table public.fin_customer_credit_notes from authenticated;
revoke all on table public.fin_supplier_debit_notes from authenticated;
revoke all on table public.fin_receivable_credit_allocations from authenticated;
revoke all on table public.fin_payable_debit_allocations from authenticated;
grant select on table public.fin_customer_credit_notes to authenticated;
grant select on table public.fin_supplier_debit_notes to authenticated;
grant select on table public.fin_receivable_credit_allocations to authenticated;
grant select on table public.fin_payable_debit_allocations to authenticated;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'fin_customer_credit_notes',
    'fin_supplier_debit_notes',
    'fin_receivable_credit_allocations',
    'fin_payable_debit_allocations'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('drop policy if exists %I on public.%I', 'erp_' || v_table || '_select', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.erp_can_access(%L, %L, created_by))',
      'erp_' || v_table || '_select', v_table, v_table, 'read'
    );

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

-- ---------------------------------------------------------------------------
-- 3. Posted-document / derived-balance mutation guards
-- ---------------------------------------------------------------------------
create or replace function public.erp_p0_is_internal_write()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(current_setting('erp.internal_write', true), 'off') = 'on';
$$;

create or replace function public.erp_guard_document_header()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  if public.erp_p0_is_internal_write() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_old_status := old.status::text;
    if v_old_status in ('posted', 'completed', 'closed', 'cancelled') then
      raise exception 'Immutable business document: % (%) is %', tg_table_name, old.id, v_old_status
        using errcode = '55000';
    end if;
    return old;
  end if;

  v_old_status := old.status::text;
  v_new_status := new.status::text;

  if v_old_status in ('posted', 'completed', 'closed', 'cancelled') then
    raise exception 'Immutable business document: % (%) is %', tg_table_name, old.id, v_old_status
      using errcode = '55000';
  end if;

  if v_new_status in ('posted', 'completed') then
    raise exception 'Use the approved posting RPC; direct status change to % is not allowed', v_new_status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.erp_guard_document_item()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_header_id uuid;
  v_parent_status text;
begin
  if public.erp_p0_is_internal_write() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_header_id := (
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> tg_argv[1]
  )::uuid;

  execute format('select status::text from public.%I where id = $1', tg_argv[0])
    into v_parent_status
    using v_header_id;

  if v_parent_status in ('posted', 'completed', 'closed', 'cancelled') then
    raise exception 'Cannot modify % because parent % (%) is %',
      tg_table_name, tg_argv[0], v_header_id, v_parent_status
      using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.erp_guard_customer_credit_used()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.credit_used is distinct from old.credit_used
     and not public.erp_p0_is_internal_write() then
    raise exception 'credit_used is system-managed and may only change through posting functions'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
  v_header_tables text[] := array[
    'pur_orders', 'pur_receipts', 'pur_returns',
    'sal_orders', 'sal_deliveries', 'sal_returns',
    'inv_adjustments', 'inv_stocktakes', 'inv_transfers',
    'fin_receipts', 'fin_payments', 'fin_expenses'
  ];
begin
  foreach v_table in array v_header_tables loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || v_table || '_p0_header_guard', v_table);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function public.erp_guard_document_header()',
      'trg_' || v_table || '_p0_header_guard', v_table
    );
  end loop;
end;
$$;

do $$
declare
  v_child text;
  v_parent text;
  v_foreign_key text;
begin
  for v_child, v_parent, v_foreign_key in
    values
      ('pur_order_items', 'pur_orders', 'order_id'),
      ('pur_receipt_items', 'pur_receipts', 'receipt_id'),
      ('pur_return_items', 'pur_returns', 'return_id'),
      ('sal_order_items', 'sal_orders', 'order_id'),
      ('sal_delivery_items', 'sal_deliveries', 'delivery_id'),
      ('sal_return_items', 'sal_returns', 'return_id'),
      ('inv_adjustment_items', 'inv_adjustments', 'adjustment_id'),
      ('inv_stocktake_items', 'inv_stocktakes', 'stocktake_id'),
      ('inv_transfer_items', 'inv_transfers', 'transfer_id')
  loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || v_child || '_p0_item_guard', v_child);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.erp_guard_document_item(%L, %L)',
      'trg_' || v_child || '_p0_item_guard', v_child, v_parent, v_foreign_key
    );
  end loop;
end;
$$;

drop trigger if exists trg_base_customers_p0_credit_guard on public.base_customers;
create trigger trg_base_customers_p0_credit_guard
before update on public.base_customers
for each row execute function public.erp_guard_customer_credit_used();

-- ---------------------------------------------------------------------------
-- 4. Internal helper functions
-- ---------------------------------------------------------------------------
create or replace function public.erp_assert_location_belongs_to_warehouse(
  p_location_id uuid,
  p_warehouse_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if p_location_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.base_warehouse_locations
    where id = p_location_id
      and warehouse_id = p_warehouse_id
      and status = 'active'
  ) then
    raise exception 'Location % does not belong to active warehouse %', p_location_id, p_warehouse_id;
  end if;
end;
$$;

-- Writes a credit application and updates receivable / credit-note balances atomically.
create or replace function public.erp_apply_customer_credit_note(
  p_credit_note_id uuid,
  p_receivable_id uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_note public.fin_customer_credit_notes%rowtype;
  v_receivable public.fin_receivables%rowtype;
  v_amount numeric(18,2) := round(coalesce(p_amount, 0), 2);
  v_outstanding numeric(18,2);
  v_note_unapplied numeric(18,2);
  v_status text;
begin
  if v_amount <= 0 then
    raise exception 'Credit application amount must be greater than zero';
  end if;

  select * into v_note
  from public.fin_customer_credit_notes
  where id = p_credit_note_id
  for update;
  if not found then
    raise exception 'Customer credit note does not exist';
  end if;
  if v_note.status = 'cancelled' then
    raise exception 'Cancelled customer credit note cannot be applied';
  end if;

  select * into v_receivable
  from public.fin_receivables
  where id = p_receivable_id
  for update;
  if not found then
    raise exception 'Receivable does not exist';
  end if;
  if v_receivable.customer_id <> v_note.customer_id then
    raise exception 'Customer credit note and receivable customer do not match';
  end if;
  if v_amount > v_note.unapplied_amount or v_amount > v_receivable.outstanding_amount then
    raise exception 'Credit application amount exceeds available credit or receivable balance';
  end if;

  v_outstanding := round(v_receivable.outstanding_amount - v_amount, 2);
  v_note_unapplied := round(v_note.unapplied_amount - v_amount, 2);
  v_status := case
    when v_outstanding = 0 then 'settled'
    when v_receivable.due_date is not null and v_receivable.due_date < current_date then 'overdue'
    else 'partial'
  end;

  update public.fin_receivables
  set credit_amount = round(credit_amount + v_amount, 2),
      outstanding_amount = v_outstanding,
      status = v_status
  where id = v_receivable.id;

  update public.fin_customer_credit_notes
  set applied_amount = round(applied_amount + v_amount, 2),
      unapplied_amount = v_note_unapplied,
      status = case when v_note_unapplied = 0 then 'applied' else 'partial' end
  where id = v_note.id;

  insert into public.fin_receivable_credit_allocations (
    credit_note_id, receivable_id, amount, remark
  ) values (
    v_note.id, v_receivable.id, v_amount, '销售退货贷项自动核销'
  );
end;
$$;

-- Writes a debit application and updates payable / debit-note balances atomically.
create or replace function public.erp_apply_supplier_debit_note(
  p_debit_note_id uuid,
  p_payable_id uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_note public.fin_supplier_debit_notes%rowtype;
  v_payable public.fin_payables%rowtype;
  v_amount numeric(18,2) := round(coalesce(p_amount, 0), 2);
  v_outstanding numeric(18,2);
  v_note_unapplied numeric(18,2);
  v_status text;
begin
  if v_amount <= 0 then
    raise exception 'Debit application amount must be greater than zero';
  end if;

  select * into v_note
  from public.fin_supplier_debit_notes
  where id = p_debit_note_id
  for update;
  if not found then
    raise exception 'Supplier debit note does not exist';
  end if;
  if v_note.status = 'cancelled' then
    raise exception 'Cancelled supplier debit note cannot be applied';
  end if;

  select * into v_payable
  from public.fin_payables
  where id = p_payable_id
  for update;
  if not found then
    raise exception 'Payable does not exist';
  end if;
  if v_payable.supplier_id <> v_note.supplier_id then
    raise exception 'Supplier debit note and payable supplier do not match';
  end if;
  if v_amount > v_note.unapplied_amount or v_amount > v_payable.outstanding_amount then
    raise exception 'Debit application amount exceeds available debit or payable balance';
  end if;

  v_outstanding := round(v_payable.outstanding_amount - v_amount, 2);
  v_note_unapplied := round(v_note.unapplied_amount - v_amount, 2);
  v_status := case
    when v_outstanding = 0 then 'settled'
    when v_payable.due_date is not null and v_payable.due_date < current_date then 'overdue'
    else 'partial'
  end;

  update public.fin_payables
  set debit_amount = round(debit_amount + v_amount, 2),
      outstanding_amount = v_outstanding,
      status = v_status
  where id = v_payable.id;

  update public.fin_supplier_debit_notes
  set applied_amount = round(applied_amount + v_amount, 2),
      unapplied_amount = v_note_unapplied,
      status = case when v_note_unapplied = 0 then 'applied' else 'partial' end
  where id = v_note.id;

  insert into public.fin_payable_debit_allocations (
    debit_note_id, payable_id, amount, remark
  ) values (
    v_note.id, v_payable.id, v_amount, '采购退货借项自动核销'
  );
end;
$$;

-- Correct stock primitive. p_input_unit_cost means incoming cost only. For all
-- outbound movements, the transaction cost is the stock's book cost.
create or replace function public.erp_apply_stock_change_v2(
  p_transaction_type text,
  p_direction text,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_batch_no text,
  p_qty numeric,
  p_input_unit_cost numeric default null,
  p_source_type text default null,
  p_source_id uuid default null,
  p_source_no text default null,
  p_source_item_id uuid default null,
  p_remark text default null,
  p_production_date date default null,
  p_expiry_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_stock public.inv_stocks%rowtype;
  v_stock_exists boolean := false;
  v_stock_id uuid;
  v_normalized_batch text := nullif(btrim(coalesce(p_batch_no, '')), '');
  v_before_qty numeric(18,6) := 0;
  v_after_qty numeric(18,6);
  v_old_cost numeric(18,4) := 0;
  v_new_cost numeric(18,4) := 0;
  v_applied_unit_cost numeric(18,4) := 0;
  v_allow_negative boolean := false;
  v_amount numeric(18,2);
  v_sys_user_id uuid;
begin
  if p_transaction_type not in (
    'purchase_receipt', 'purchase_return', 'sales_delivery', 'sales_return',
    'adjustment_gain', 'adjustment_loss', 'stocktake_gain', 'stocktake_loss',
    'transfer_out', 'transfer_in', 'opening_balance', 'reservation', 'release_reservation'
  ) then
    raise exception 'Unsupported transaction type: %', p_transaction_type;
  end if;

  if p_direction not in ('in', 'out') then
    raise exception 'Inventory posting supports only in/out directions';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_product_id is null or p_warehouse_id is null then
    raise exception 'Product and warehouse are required';
  end if;

  perform public.erp_assert_location_belongs_to_warehouse(p_location_id, p_warehouse_id);

  select allow_negative_stock into v_allow_negative
  from public.base_warehouses
  where id = p_warehouse_id
    and status = 'active';
  if not found then
    raise exception 'Active warehouse does not exist: %', p_warehouse_id;
  end if;

  -- Serializes a nullable stock dimension before selecting/inserting it.
  perform pg_advisory_xact_lock(
    hashtext(
      p_product_id::text || ':' || p_warehouse_id::text || ':' ||
      coalesce(p_location_id::text, '') || ':' || coalesce(v_normalized_batch, '')
    )
  );

  select * into v_stock
  from public.inv_stocks
  where product_id = p_product_id
    and warehouse_id = p_warehouse_id
    and location_id is not distinct from p_location_id
    and batch_no is not distinct from v_normalized_batch
  for update;

  v_stock_exists := found;
  if v_stock_exists then
    v_stock_id := v_stock.id;
    v_before_qty := v_stock.quantity_on_hand;
    v_old_cost := v_stock.unit_cost;
  end if;

  if p_direction = 'in' then
    v_after_qty := v_before_qty + p_qty;
    v_applied_unit_cost := round(coalesce(nullif(p_input_unit_cost, 0), v_old_cost, 0), 4);
    v_new_cost := case
      when v_before_qty <= 0 then v_applied_unit_cost
      when v_applied_unit_cost <= 0 then v_old_cost
      else round(((v_before_qty * v_old_cost) + (p_qty * v_applied_unit_cost)) / v_after_qty, 4)
    end;
  else
    v_after_qty := v_before_qty - p_qty;
    if v_after_qty < 0 and not v_allow_negative then
      raise exception 'Insufficient stock: product %, warehouse %, location %, batch %; on_hand %',
        p_product_id, p_warehouse_id, coalesce(p_location_id::text, '-'),
        coalesce(v_normalized_batch, '-'), v_before_qty;
    end if;

    -- p_input_unit_cost is deliberately ignored when normal stock cost exists.
    v_applied_unit_cost := round(coalesce(nullif(v_old_cost, 0), nullif(p_input_unit_cost, 0), 0), 4);
    v_new_cost := v_applied_unit_cost;
  end if;

  if v_stock_id is null then
    insert into public.inv_stocks (
      product_id, warehouse_id, location_id, batch_no, production_date, expiry_date,
      quantity_on_hand, quantity_reserved, quantity_available,
      unit_cost, total_cost, last_inbound_at, last_outbound_at, version_no
    ) values (
      p_product_id, p_warehouse_id, p_location_id, v_normalized_batch, p_production_date, p_expiry_date,
      v_after_qty, 0, v_after_qty,
      v_new_cost, round(v_after_qty * v_new_cost, 2),
      case when p_direction = 'in' then now() else null end,
      case when p_direction = 'out' then now() else null end,
      1
    ) returning id into v_stock_id;
  else
    update public.inv_stocks
    set quantity_on_hand = v_after_qty,
        quantity_available = v_after_qty - quantity_reserved,
        unit_cost = v_new_cost,
        total_cost = round(v_after_qty * v_new_cost, 2),
        last_inbound_at = case when p_direction = 'in' then now() else last_inbound_at end,
        last_outbound_at = case when p_direction = 'out' then now() else last_outbound_at end,
        version_no = version_no + 1,
        production_date = coalesce(production_date, p_production_date),
        expiry_date = coalesce(expiry_date, p_expiry_date)
    where id = v_stock_id;
  end if;

  v_amount := round(p_qty * v_applied_unit_cost, 2);
  v_sys_user_id := public.erp_current_sys_user_id();

  insert into public.inv_transactions (
    transaction_no, transaction_type, direction, product_id, warehouse_id, location_id,
    batch_no, stock_id, qty, unit_cost, amount, before_qty, after_qty,
    source_type, source_id, source_no, source_item_id, operator_user_id, remark
  ) values (
    public.erp_next_document_no('TX', current_date), p_transaction_type, p_direction,
    p_product_id, p_warehouse_id, p_location_id, v_normalized_batch, v_stock_id,
    p_qty, v_applied_unit_cost, v_amount, v_before_qty, v_after_qty,
    p_source_type, p_source_id, p_source_no, p_source_item_id, v_sys_user_id, p_remark
  );

  return jsonb_build_object(
    'stock_id', v_stock_id,
    'before_qty', v_before_qty,
    'after_qty', v_after_qty,
    'unit_cost', v_applied_unit_cost,
    'amount', v_amount
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Replace inventory posting with P0-safe implementation
-- ---------------------------------------------------------------------------
create or replace function public.erp_post_inventory(
  p_source_type text,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_receipt public.pur_receipts%rowtype;
  v_purchase_return public.pur_returns%rowtype;
  v_delivery public.sal_deliveries%rowtype;
  v_sales_return public.sal_returns%rowtype;
  v_adjustment public.inv_adjustments%rowtype;
  v_stocktake public.inv_stocktakes%rowtype;
  v_transfer public.inv_transfers%rowtype;
  v_customer public.base_customers%rowtype;
  v_order_item public.pur_order_items%rowtype;
  v_sales_order_item public.sal_order_items%rowtype;
  v_source_receipt_item public.pur_receipt_items%rowtype;
  v_source_delivery_item public.sal_delivery_items%rowtype;
  v_item record;
  v_calc_qty numeric(18,6);
  v_calc_amount numeric(18,2);
  v_due_date date;
  v_status text;
  v_gain_amount numeric(18,2);
  v_loss_amount numeric(18,2);
  v_existing_return_qty numeric(18,6);
  v_return_cost numeric(18,4);
  v_stock_result jsonb;
  v_outbound_cost numeric(18,4);
  v_credit_note_id uuid;
  v_debit_note_id uuid;
  v_receivable_id uuid;
  v_payable_id uuid;
  v_outstanding numeric(18,2);
  v_apply_amount numeric(18,2);
begin
  if p_source_id is null then
    raise exception 'Document id is required';
  end if;

  -- Grants all mutations made by this trusted function permission to cross
  -- posted-document and derived-balance guards within this transaction only.
  perform set_config('erp.internal_write', 'on', true);

  case p_source_type
    when 'purchase_receipt' then
      perform public.erp_require_permission('purchase:receipt:approve');
      select * into v_receipt from public.pur_receipts where id = p_source_id for update;
      if not found then raise exception 'Purchase receipt does not exist'; end if;
      if v_receipt.status = 'posted' then
        return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);
      end if;
      if v_receipt.status in ('cancelled') then raise exception 'Cancelled receipt cannot be posted'; end if;

      select coalesce(sum(qty), 0), coalesce(sum(amount), 0)
      into v_calc_qty, v_calc_amount
      from public.pur_receipt_items where receipt_id = v_receipt.id;
      if v_calc_qty <= 0 then raise exception 'Purchase receipt must contain at least one item'; end if;
      if round(v_calc_qty, 6) <> round(v_receipt.total_qty, 6)
         or round(v_calc_amount, 2) <> round(v_receipt.total_amount, 2) then
        raise exception 'Purchase receipt header totals do not match item totals';
      end if;

      for v_item in select * from public.pur_receipt_items where receipt_id = v_receipt.id order by line_no loop
        if v_item.order_item_id is not null then
          select * into v_order_item
          from public.pur_order_items
          where id = v_item.order_item_id
          for update;
          if not found or v_order_item.order_id is distinct from v_receipt.order_id then
            raise exception 'Receipt item % does not belong to the linked purchase order', v_item.id;
          end if;
          if v_order_item.received_qty + v_item.qty > v_order_item.qty then
            raise exception 'Receipt quantity exceeds outstanding purchase-order quantity for item %', v_order_item.id;
          end if;
        end if;

        perform public.erp_apply_stock_change_v2(
          'purchase_receipt', 'in', v_item.product_id, v_receipt.warehouse_id, v_item.location_id,
          v_item.batch_no, v_item.qty, v_item.unit_price, 'purchase_receipt', v_receipt.id,
          v_receipt.receipt_no, v_item.id, v_item.remark, v_item.production_date, v_item.expiry_date
        );

        if v_item.order_item_id is not null then
          update public.pur_order_items
          set received_qty = received_qty + v_item.qty
          where id = v_item.order_item_id;
        end if;
      end loop;

      if v_receipt.order_id is not null then
        select case
          when bool_and(received_qty >= qty) then 'completed'
          when bool_or(received_qty > 0) then 'partial_received'
          else 'approved'
        end into v_status
        from public.pur_order_items where order_id = v_receipt.order_id;
        update public.pur_orders set status = coalesce(v_status, status) where id = v_receipt.order_id;
      end if;

      select v_receipt.receipt_date + s.payment_term_days
      into v_due_date
      from public.base_suppliers s where s.id = v_receipt.supplier_id;

      if not exists (
        select 1 from public.fin_payables
        where source_type = 'purchase_receipt'
          and source_id = v_receipt.id
          and status <> 'cancelled'
      ) then
        insert into public.fin_payables (
          payable_no, supplier_id, source_type, source_id, source_no, bill_date, due_date,
          original_amount, paid_amount, outstanding_amount, writeoff_amount, debit_amount, status, remark
        ) values (
          public.erp_next_document_no('AP', v_receipt.receipt_date), v_receipt.supplier_id,
          'purchase_receipt', v_receipt.id, v_receipt.receipt_no, v_receipt.receipt_date, v_due_date,
          v_receipt.total_amount, 0, v_receipt.total_amount, 0, 0,
          case when v_due_date < current_date then 'overdue' else 'open' end,
          '由采购收货单自动生成'
        );
      end if;

      update public.pur_receipts set status = 'posted', posted_at = now() where id = v_receipt.id;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);

    when 'purchase_return' then
      perform public.erp_require_permission('purchase:return:approve');
      select * into v_purchase_return from public.pur_returns where id = p_source_id for update;
      if not found then raise exception 'Purchase return does not exist'; end if;
      if v_purchase_return.status = 'posted' then
        return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);
      end if;
      if v_purchase_return.status = 'cancelled' then raise exception 'Cancelled purchase return cannot be posted'; end if;
      if v_purchase_return.receipt_id is null then raise exception 'Purchase return must reference a purchase receipt'; end if;

      select coalesce(sum(qty), 0), coalesce(sum(amount), 0)
      into v_calc_qty, v_calc_amount
      from public.pur_return_items where return_id = v_purchase_return.id;
      if v_calc_qty <= 0 then raise exception 'Purchase return must contain at least one item'; end if;
      if round(v_calc_qty, 6) <> round(v_purchase_return.total_qty, 6)
         or round(v_calc_amount, 2) <> round(v_purchase_return.total_amount, 2) then
        raise exception 'Purchase return header totals do not match item totals';
      end if;

      for v_item in select * from public.pur_return_items where return_id = v_purchase_return.id order by line_no loop
        if v_item.receipt_item_id is null then
          raise exception 'Purchase return item % must reference a purchase receipt item', v_item.id;
        end if;

        select * into v_source_receipt_item
        from public.pur_receipt_items
        where id = v_item.receipt_item_id
          and receipt_id = v_purchase_return.receipt_id
        for update;
        if not found then
          raise exception 'Purchase return item % is not from the selected receipt', v_item.id;
        end if;
        if v_source_receipt_item.product_id <> v_item.product_id then
          raise exception 'Purchase return product does not match its source receipt item';
        end if;

        select coalesce(sum(ri.qty), 0)
        into v_existing_return_qty
        from public.pur_return_items ri
        join public.pur_returns r on r.id = ri.return_id
        where ri.receipt_item_id = v_item.receipt_item_id
          and r.status = 'posted'
          and r.id <> v_purchase_return.id;

        if v_existing_return_qty + v_item.qty > v_source_receipt_item.qty then
          raise exception 'Purchase return quantity exceeds received quantity for source receipt item %', v_item.receipt_item_id;
        end if;

        perform public.erp_apply_stock_change_v2(
          'purchase_return', 'out', v_item.product_id, v_purchase_return.warehouse_id, v_item.location_id,
          v_item.batch_no, v_item.qty, null, 'purchase_return', v_purchase_return.id,
          v_purchase_return.return_no, v_item.id, v_item.remark
        );
      end loop;

      -- Free-of-charge return lines can have a zero financial amount. They still
      -- post inventory, but do not need a debit note.
      if v_purchase_return.total_amount > 0 then
        insert into public.fin_supplier_debit_notes (
          debit_note_no, supplier_id, source_type, source_id, source_no, note_date,
          original_amount, applied_amount, unapplied_amount, status, remark
        ) values (
          public.erp_next_document_no('DN', v_purchase_return.return_date), v_purchase_return.supplier_id,
          'purchase_return', v_purchase_return.id, v_purchase_return.return_no, v_purchase_return.return_date,
          v_purchase_return.total_amount, 0, v_purchase_return.total_amount, 'open',
          '由采购退货单自动生成'
        ) on conflict (source_type, source_id) do nothing
        returning id into v_debit_note_id;

        if v_debit_note_id is null then
          select id into v_debit_note_id
          from public.fin_supplier_debit_notes
          where source_type = 'purchase_return' and source_id = v_purchase_return.id
          for update;
        end if;

        select id, outstanding_amount
        into v_payable_id, v_outstanding
        from public.fin_payables
        where source_type = 'purchase_receipt'
          and source_id = v_purchase_return.receipt_id
          and status <> 'cancelled'
        order by created_at
        limit 1
        for update;

        if found and v_outstanding > 0 then
          v_apply_amount := least(v_purchase_return.total_amount, v_outstanding);
          perform public.erp_apply_supplier_debit_note(v_debit_note_id, v_payable_id, v_apply_amount);
        end if;
      end if;

      update public.pur_returns set status = 'posted' where id = v_purchase_return.id;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id, 'debit_note_id', v_debit_note_id);

    when 'sales_delivery' then
      perform public.erp_require_permission('sales:delivery:approve');
      select * into v_delivery from public.sal_deliveries where id = p_source_id for update;
      if not found then raise exception 'Sales delivery does not exist'; end if;
      if v_delivery.status = 'posted' then
        return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);
      end if;
      if v_delivery.status = 'cancelled' then raise exception 'Cancelled delivery cannot be posted'; end if;

      -- Locks the customer row so concurrent deliveries cannot both pass a stale credit check.
      select * into v_customer
      from public.base_customers
      where id = v_delivery.customer_id
        and status = 'active'
      for update;
      if not found then raise exception 'Active customer does not exist'; end if;
      -- Current compatibility rule: credit_limit = 0 means no limit. Change this
      -- only after introducing an explicit credit_control_enabled field.
      if v_customer.credit_limit > 0
         and v_customer.credit_used + v_delivery.total_amount > v_customer.credit_limit then
        raise exception 'Customer credit limit exceeded: used %, delivery %, limit %',
          v_customer.credit_used, v_delivery.total_amount, v_customer.credit_limit;
      end if;

      select coalesce(sum(qty), 0), coalesce(sum(amount), 0)
      into v_calc_qty, v_calc_amount
      from public.sal_delivery_items where delivery_id = v_delivery.id;
      if v_calc_qty <= 0 then raise exception 'Sales delivery must contain at least one item'; end if;
      if round(v_calc_qty, 6) <> round(v_delivery.total_qty, 6)
         or round(v_calc_amount, 2) <> round(v_delivery.total_amount, 2) then
        raise exception 'Sales delivery header totals do not match item totals';
      end if;

      for v_item in select * from public.sal_delivery_items where delivery_id = v_delivery.id order by line_no loop
        if v_item.order_item_id is not null then
          select * into v_sales_order_item
          from public.sal_order_items
          where id = v_item.order_item_id
          for update;
          if not found or v_sales_order_item.order_id is distinct from v_delivery.order_id then
            raise exception 'Delivery item % does not belong to the linked sales order', v_item.id;
          end if;
          if v_sales_order_item.delivered_qty + v_item.qty > v_sales_order_item.qty then
            raise exception 'Delivery quantity exceeds outstanding sales-order quantity for item %', v_sales_order_item.id;
          end if;
        end if;

        perform public.erp_apply_stock_change_v2(
          'sales_delivery', 'out', v_item.product_id, v_delivery.warehouse_id, v_item.location_id,
          v_item.batch_no, v_item.qty, null, 'sales_delivery', v_delivery.id,
          v_delivery.delivery_no, v_item.id, v_item.remark
        );

        if v_item.order_item_id is not null then
          update public.sal_order_items
          set delivered_qty = delivered_qty + v_item.qty
          where id = v_item.order_item_id;
        end if;
      end loop;

      if v_delivery.order_id is not null then
        select case
          when bool_and(delivered_qty >= qty) then 'completed'
          when bool_or(delivered_qty > 0) then 'partial_delivered'
          else 'approved'
        end into v_status
        from public.sal_order_items where order_id = v_delivery.order_id;
        update public.sal_orders set status = coalesce(v_status, status) where id = v_delivery.order_id;
      end if;

      if not exists (
        select 1 from public.fin_receivables
        where source_type = 'sales_delivery'
          and source_id = v_delivery.id
          and status <> 'cancelled'
      ) then
        select v_delivery.delivery_date + payment_term_days
        into v_due_date
        from public.base_customers
        where id = v_delivery.customer_id;

        insert into public.fin_receivables (
          receivable_no, customer_id, source_type, source_id, source_no, bill_date, due_date,
          original_amount, received_amount, outstanding_amount, writeoff_amount, credit_amount, status, remark
        ) values (
          public.erp_next_document_no('AR', v_delivery.delivery_date), v_delivery.customer_id,
          'sales_delivery', v_delivery.id, v_delivery.delivery_no, v_delivery.delivery_date, v_due_date,
          v_delivery.total_amount, 0, v_delivery.total_amount, 0, 0,
          case when v_due_date < current_date then 'overdue' else 'open' end,
          '由销售发货单自动生成'
        );

        update public.base_customers
        set credit_used = credit_used + v_delivery.total_amount
        where id = v_delivery.customer_id;
      end if;

      update public.sal_deliveries set status = 'posted', posted_at = now() where id = v_delivery.id;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);

    when 'sales_return' then
      perform public.erp_require_permission('sales:return:approve');
      select * into v_sales_return from public.sal_returns where id = p_source_id for update;
      if not found then raise exception 'Sales return does not exist'; end if;
      if v_sales_return.status = 'posted' then
        return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);
      end if;
      if v_sales_return.status = 'cancelled' then raise exception 'Cancelled sales return cannot be posted'; end if;
      if v_sales_return.delivery_id is null then raise exception 'Sales return must reference a sales delivery'; end if;

      select coalesce(sum(qty), 0), coalesce(sum(amount), 0)
      into v_calc_qty, v_calc_amount
      from public.sal_return_items where return_id = v_sales_return.id;
      if v_calc_qty <= 0 then raise exception 'Sales return must contain at least one item'; end if;
      if round(v_calc_qty, 6) <> round(v_sales_return.total_qty, 6)
         or round(v_calc_amount, 2) <> round(v_sales_return.total_amount, 2) then
        raise exception 'Sales return header totals do not match item totals';
      end if;

      for v_item in select * from public.sal_return_items where return_id = v_sales_return.id order by line_no loop
        if v_item.delivery_item_id is null then
          raise exception 'Sales return item % must reference a sales delivery item', v_item.id;
        end if;

        select * into v_source_delivery_item
        from public.sal_delivery_items
        where id = v_item.delivery_item_id
          and delivery_id = v_sales_return.delivery_id
        for update;
        if not found then
          raise exception 'Sales return item % is not from the selected delivery', v_item.id;
        end if;
        if v_source_delivery_item.product_id <> v_item.product_id then
          raise exception 'Sales return product does not match its source delivery item';
        end if;

        select coalesce(sum(ri.qty), 0)
        into v_existing_return_qty
        from public.sal_return_items ri
        join public.sal_returns r on r.id = ri.return_id
        where ri.delivery_item_id = v_item.delivery_item_id
          and r.status = 'posted'
          and r.id <> v_sales_return.id;

        if v_existing_return_qty + v_item.qty > v_source_delivery_item.qty then
          raise exception 'Sales return quantity exceeds delivered quantity for source delivery item %', v_item.delivery_item_id;
        end if;

        if v_item.quality_status <> 'rejected' then
          select unit_cost into v_return_cost
          from public.inv_transactions
          where transaction_type = 'sales_delivery'
            and source_id = v_sales_return.delivery_id
            and source_item_id = v_item.delivery_item_id
          order by transaction_at desc
          limit 1;

          if v_return_cost is null then
            raise exception 'Original outbound cost is unavailable for delivery item %. Do not post returns for pre-P0 deliveries without a historical cost correction.', v_item.delivery_item_id;
          end if;

          perform public.erp_apply_stock_change_v2(
            'sales_return', 'in', v_item.product_id, v_sales_return.warehouse_id, v_item.location_id,
            v_item.batch_no, v_item.qty, v_return_cost, 'sales_return', v_sales_return.id,
            v_sales_return.return_no, v_item.id, v_item.remark
          );
        end if;
      end loop;

      -- Free-of-charge return lines can have a zero financial amount. They still
      -- restore qualified stock, but do not need a customer credit note.
      if v_sales_return.total_amount > 0 then
        insert into public.fin_customer_credit_notes (
          credit_note_no, customer_id, source_type, source_id, source_no, note_date,
          original_amount, applied_amount, unapplied_amount, status, remark
        ) values (
          public.erp_next_document_no('CN', v_sales_return.return_date), v_sales_return.customer_id,
          'sales_return', v_sales_return.id, v_sales_return.return_no, v_sales_return.return_date,
          v_sales_return.total_amount, 0, v_sales_return.total_amount, 'open',
          '由销售退货单自动生成'
        ) on conflict (source_type, source_id) do nothing
        returning id into v_credit_note_id;

        if v_credit_note_id is null then
          select id into v_credit_note_id
          from public.fin_customer_credit_notes
          where source_type = 'sales_return' and source_id = v_sales_return.id
          for update;
        end if;

        select id, outstanding_amount
        into v_receivable_id, v_outstanding
        from public.fin_receivables
        where source_type = 'sales_delivery'
          and source_id = v_sales_return.delivery_id
          and status <> 'cancelled'
        order by created_at
        limit 1
        for update;

        if found and v_outstanding > 0 then
          v_apply_amount := least(v_sales_return.total_amount, v_outstanding);
          perform public.erp_apply_customer_credit_note(v_credit_note_id, v_receivable_id, v_apply_amount);
        end if;
      end if;

      -- A return reduces exposure whether it offsets an open receivable now or
      -- leaves an unapplied customer credit for a future sale/refund.
      update public.base_customers
      set credit_used = greatest(credit_used - v_sales_return.total_amount, 0)
      where id = v_sales_return.customer_id;

      update public.sal_returns set status = 'posted' where id = v_sales_return.id;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id, 'credit_note_id', v_credit_note_id);

    when 'adjustment' then
      perform public.erp_require_permission('inventory:adjustment:approve');
      select * into v_adjustment from public.inv_adjustments where id = p_source_id for update;
      if not found then raise exception 'Inventory adjustment does not exist'; end if;
      if v_adjustment.status = 'posted' then
        return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);
      end if;
      if v_adjustment.status = 'cancelled' then raise exception 'Cancelled adjustment cannot be posted'; end if;

      for v_item in select * from public.inv_adjustment_items where adjustment_id = v_adjustment.id order by line_no loop
        perform public.erp_apply_stock_change_v2(
          case when v_adjustment.adjustment_type = 'gain' then 'adjustment_gain' else 'adjustment_loss' end,
          case when v_adjustment.adjustment_type = 'gain' then 'in' else 'out' end,
          v_item.product_id, v_adjustment.warehouse_id, v_item.location_id, v_item.batch_no,
          v_item.adjustment_qty,
          case when v_adjustment.adjustment_type = 'gain' then v_item.unit_cost else null end,
          'adjustment', v_adjustment.id, v_adjustment.adjustment_no, v_item.id,
          coalesce(v_item.reason, v_adjustment.reason)
        );
      end loop;

      update public.inv_adjustments set status = 'posted' where id = v_adjustment.id;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);

    when 'stocktake' then
      perform public.erp_require_permission('inventory:stocktake:approve');
      select * into v_stocktake from public.inv_stocktakes where id = p_source_id for update;
      if not found then raise exception 'Stocktake does not exist'; end if;
      if v_stocktake.status = 'posted' then
        return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);
      end if;
      if v_stocktake.status = 'cancelled' then raise exception 'Cancelled stocktake cannot be posted'; end if;
      if exists (
        select 1 from public.inv_stocktake_items
        where stocktake_id = v_stocktake.id and actual_qty is null
      ) then
        raise exception 'All stocktake items must be counted before posting';
      end if;

      for v_item in
        select * from public.inv_stocktake_items
        where stocktake_id = v_stocktake.id and difference_qty <> 0
        order by line_no
      loop
        perform public.erp_apply_stock_change_v2(
          case when v_item.difference_qty > 0 then 'stocktake_gain' else 'stocktake_loss' end,
          case when v_item.difference_qty > 0 then 'in' else 'out' end,
          v_item.product_id, v_stocktake.warehouse_id, v_item.location_id, v_item.batch_no,
          abs(v_item.difference_qty),
          case when v_item.difference_qty > 0 then v_item.unit_cost else null end,
          'stocktake', v_stocktake.id, v_stocktake.stocktake_no, v_item.id, v_item.remark
        );
      end loop;

      select
        coalesce(sum(case when difference_amount > 0 then difference_amount else 0 end), 0),
        coalesce(abs(sum(case when difference_amount < 0 then difference_amount else 0 end)), 0)
      into v_gain_amount, v_loss_amount
      from public.inv_stocktake_items
      where stocktake_id = v_stocktake.id;

      update public.inv_stocktakes
      set status = 'posted',
          gain_amount = coalesce(v_gain_amount, 0),
          loss_amount = coalesce(v_loss_amount, 0)
      where id = v_stocktake.id;

      update public.inv_stocktake_items
      set status = 'posted'
      where stocktake_id = v_stocktake.id;

      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);

    when 'transfer' then
      perform public.erp_require_permission('inventory:transfer:approve');
      select * into v_transfer from public.inv_transfers where id = p_source_id for update;
      if not found then raise exception 'Transfer does not exist'; end if;
      if v_transfer.status = 'completed' then
        return jsonb_build_object('success', true, 'status', 'completed', 'document_id', p_source_id);
      end if;
      if v_transfer.status = 'cancelled' then raise exception 'Cancelled transfer cannot be posted'; end if;

      for v_item in select * from public.inv_transfer_items where transfer_id = v_transfer.id order by line_no loop
        v_stock_result := public.erp_apply_stock_change_v2(
          'transfer_out', 'out', v_item.product_id, v_transfer.from_warehouse_id, v_item.from_location_id,
          v_item.batch_no, v_item.qty, null, 'transfer', v_transfer.id, v_transfer.transfer_no,
          v_item.id, v_item.remark
        );
        v_outbound_cost := coalesce((v_stock_result ->> 'unit_cost')::numeric, 0);

        perform public.erp_apply_stock_change_v2(
          'transfer_in', 'in', v_item.product_id, v_transfer.to_warehouse_id, v_item.to_location_id,
          v_item.batch_no, v_item.qty, v_outbound_cost, 'transfer', v_transfer.id, v_transfer.transfer_no,
          v_item.id, v_item.remark
        );

        update public.inv_transfer_items
        set outbound_qty = qty,
            inbound_qty = qty,
            unit_cost = v_outbound_cost
        where id = v_item.id;
      end loop;

      update public.inv_transfers
      set status = 'completed', outbound_at = now(), inbound_at = now()
      where id = v_transfer.id;

      return jsonb_build_object('success', true, 'status', 'completed', 'document_id', p_source_id);

    else
      raise exception 'Unsupported source type: %', p_source_type;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Finance posting functions: enable trusted internal writes and stricter state checks
-- ---------------------------------------------------------------------------
create or replace function public.erp_post_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_receipt public.fin_receipts%rowtype;
  v_receivable public.fin_receivables%rowtype;
  v_allocation record;
  v_allocated_total numeric(18,2) := 0;
  v_new_received numeric(18,2);
  v_new_outstanding numeric(18,2);
  v_status text;
  v_operator_id uuid;
begin
  perform public.erp_require_permission('finance:receipt:approve');
  perform set_config('erp.internal_write', 'on', true);

  select * into v_receipt
  from public.fin_receipts
  where id = p_receipt_id
  for update;

  if not found then raise exception 'Receipt voucher does not exist'; end if;
  if v_receipt.status = 'posted' then
    return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_receipt_id);
  end if;
  if v_receipt.status = 'cancelled' then raise exception 'Cancelled receipt voucher cannot be posted'; end if;
  if v_receipt.amount <= 0 then raise exception 'Receipt amount must be greater than zero'; end if;

  select coalesce(sum(round(x.amount, 2)), 0)
  into v_allocated_total
  from jsonb_to_recordset(coalesce(v_receipt.allocations, '[]'::jsonb)) as x(receivable_id uuid, amount numeric);

  if round(v_allocated_total, 2) <> round(v_receipt.allocated_amount, 2) then
    raise exception 'Receipt allocation total does not match allocated_amount';
  end if;
  if round(v_allocated_total, 2) > round(v_receipt.amount, 2) then
    raise exception 'Receipt allocation total cannot exceed receipt amount';
  end if;

  for v_allocation in
    select receivable_id, round(sum(amount), 2) as amount
    from jsonb_to_recordset(coalesce(v_receipt.allocations, '[]'::jsonb)) as x(receivable_id uuid, amount numeric)
    where amount is not null and amount > 0
    group by receivable_id
  loop
    select * into v_receivable
    from public.fin_receivables
    where id = v_allocation.receivable_id
    for update;

    if not found then raise exception 'Receivable % does not exist', v_allocation.receivable_id; end if;
    if v_receivable.customer_id <> v_receipt.customer_id then
      raise exception 'Receivable % does not belong to the receipt customer', v_allocation.receivable_id;
    end if;
    if v_receivable.status in ('settled', 'cancelled', 'written_off') then
      raise exception 'Receivable % cannot be settled', v_receivable.receivable_no;
    end if;
    if round(v_allocation.amount, 2) > round(v_receivable.outstanding_amount, 2) then
      raise exception 'Allocated amount exceeds outstanding balance for receivable %', v_receivable.receivable_no;
    end if;

    v_new_received := round(v_receivable.received_amount + v_allocation.amount, 2);
    v_new_outstanding := round(v_receivable.outstanding_amount - v_allocation.amount, 2);
    v_status := case
      when v_new_outstanding = 0 then 'settled'
      when v_receivable.due_date is not null and v_receivable.due_date < current_date then 'overdue'
      else 'partial'
    end;

    update public.fin_receivables
    set received_amount = v_new_received,
        outstanding_amount = v_new_outstanding,
        status = v_status
    where id = v_receivable.id;
  end loop;

  v_operator_id := public.erp_current_sys_user_id();
  update public.fin_receipts
  set status = 'posted',
      handler_user_id = coalesce(handler_user_id, v_operator_id),
      allocated_amount = round(v_allocated_total, 2),
      unallocated_amount = round(v_receipt.amount - v_allocated_total, 2)
  where id = v_receipt.id;

  update public.base_customers
  set credit_used = greatest(credit_used - v_allocated_total, 0)
  where id = v_receipt.customer_id;

  return jsonb_build_object(
    'success', true,
    'status', 'posted',
    'document_id', p_receipt_id,
    'allocated_amount', v_allocated_total,
    'unallocated_amount', round(v_receipt.amount - v_allocated_total, 2)
  );
end;
$$;

create or replace function public.erp_post_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_payment public.fin_payments%rowtype;
  v_payable public.fin_payables%rowtype;
  v_allocation record;
  v_allocated_total numeric(18,2) := 0;
  v_new_paid numeric(18,2);
  v_new_outstanding numeric(18,2);
  v_status text;
  v_operator_id uuid;
begin
  perform public.erp_require_permission('finance:payment:approve');
  perform set_config('erp.internal_write', 'on', true);

  select * into v_payment
  from public.fin_payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'Payment voucher does not exist'; end if;
  if v_payment.status = 'posted' then
    return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_payment_id);
  end if;
  if v_payment.status = 'cancelled' then raise exception 'Cancelled payment voucher cannot be posted'; end if;
  if v_payment.amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;

  select coalesce(sum(round(x.amount, 2)), 0)
  into v_allocated_total
  from jsonb_to_recordset(coalesce(v_payment.allocations, '[]'::jsonb)) as x(payable_id uuid, amount numeric);

  if round(v_allocated_total, 2) <> round(v_payment.allocated_amount, 2) then
    raise exception 'Payment allocation total does not match allocated_amount';
  end if;
  if round(v_allocated_total, 2) > round(v_payment.amount, 2) then
    raise exception 'Payment allocation total cannot exceed payment amount';
  end if;

  for v_allocation in
    select payable_id, round(sum(amount), 2) as amount
    from jsonb_to_recordset(coalesce(v_payment.allocations, '[]'::jsonb)) as x(payable_id uuid, amount numeric)
    where amount is not null and amount > 0
    group by payable_id
  loop
    select * into v_payable
    from public.fin_payables
    where id = v_allocation.payable_id
    for update;

    if not found then raise exception 'Payable % does not exist', v_allocation.payable_id; end if;
    if v_payable.supplier_id <> v_payment.supplier_id then
      raise exception 'Payable % does not belong to the payment supplier', v_allocation.payable_id;
    end if;
    if v_payable.status in ('settled', 'cancelled', 'written_off') then
      raise exception 'Payable % cannot be settled', v_payable.payable_no;
    end if;
    if round(v_allocation.amount, 2) > round(v_payable.outstanding_amount, 2) then
      raise exception 'Allocated amount exceeds outstanding balance for payable %', v_payable.payable_no;
    end if;

    v_new_paid := round(v_payable.paid_amount + v_allocation.amount, 2);
    v_new_outstanding := round(v_payable.outstanding_amount - v_allocation.amount, 2);
    v_status := case
      when v_new_outstanding = 0 then 'settled'
      when v_payable.due_date is not null and v_payable.due_date < current_date then 'overdue'
      else 'partial'
    end;

    update public.fin_payables
    set paid_amount = v_new_paid,
        outstanding_amount = v_new_outstanding,
        status = v_status
    where id = v_payable.id;
  end loop;

  v_operator_id := public.erp_current_sys_user_id();
  update public.fin_payments
  set status = 'posted',
      handler_user_id = coalesce(handler_user_id, v_operator_id),
      allocated_amount = round(v_allocated_total, 2),
      unallocated_amount = round(v_payment.amount - v_allocated_total, 2)
  where id = v_payment.id;

  return jsonb_build_object(
    'success', true,
    'status', 'posted',
    'document_id', p_payment_id,
    'allocated_amount', v_allocated_total,
    'unallocated_amount', round(v_payment.amount - v_allocated_total, 2)
  );
end;
$$;

create or replace function public.erp_post_expense(p_expense_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_expense public.fin_expenses%rowtype;
  v_operator_id uuid;
begin
  perform public.erp_require_permission('finance:expense:approve');
  perform set_config('erp.internal_write', 'on', true);

  select * into v_expense
  from public.fin_expenses
  where id = p_expense_id
  for update;

  if not found then raise exception 'Expense voucher does not exist'; end if;
  if v_expense.status = 'posted' then
    return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_expense_id);
  end if;
  if v_expense.status in ('cancelled', 'rejected') then
    raise exception 'Cancelled or rejected expense cannot be posted';
  end if;
  if v_expense.amount <= 0 then raise exception 'Expense amount must be greater than zero'; end if;

  v_operator_id := public.erp_current_sys_user_id();
  update public.fin_expenses
  set status = 'posted',
      reviewer_user_id = coalesce(reviewer_user_id, v_operator_id),
      reviewed_at = coalesce(reviewed_at, now())
  where id = v_expense.id;

  return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_expense_id);
end;
$$;

-- New helpers are internal only. Existing public entry points remain callable by
-- authenticated users and enforce their own approve permissions.
revoke all on function public.erp_p0_is_internal_write() from public;
revoke all on function public.erp_guard_document_header() from public;
revoke all on function public.erp_guard_document_item() from public;
revoke all on function public.erp_guard_customer_credit_used() from public;
revoke all on function public.erp_assert_location_belongs_to_warehouse(uuid, uuid) from public;
revoke all on function public.erp_apply_customer_credit_note(uuid, uuid, numeric) from public;
revoke all on function public.erp_apply_supplier_debit_note(uuid, uuid, numeric) from public;
revoke all on function public.erp_apply_stock_change_v2(text, text, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, uuid, text, date, date) from public;

revoke all on function public.erp_post_inventory(text, uuid) from public;
revoke all on function public.erp_post_receipt(uuid) from public;
revoke all on function public.erp_post_payment(uuid) from public;
revoke all on function public.erp_post_expense(uuid) from public;

grant execute on function public.erp_post_inventory(text, uuid) to authenticated;
grant execute on function public.erp_post_receipt(uuid) to authenticated;
grant execute on function public.erp_post_payment(uuid) to authenticated;
grant execute on function public.erp_post_expense(uuid) to authenticated;

commit;
