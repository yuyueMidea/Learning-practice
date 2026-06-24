-- ============================================================================
-- ERP Phase 5-7: purchase / sales / inventory business workflow functions
-- Compatible with erp_phase_1_supabase_schema_final.sql.
-- Run once in Supabase Dashboard > SQL Editor after Phase 1 + Phase 3 migration.
-- No Edge Function or service_role key is required.
-- ============================================================================

begin;

-- Active ERP profile for the authenticated Supabase Auth user.
create or replace function public.erp_current_sys_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select id
  from public.sys_users
  where auth_user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- Concurrent-safe document number generator. Example: PO202606240001.
create or replace function public.erp_next_document_no(
  p_prefix text,
  p_document_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_base text;
  v_next integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  v_prefix := upper(regexp_replace(coalesce(p_prefix, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_prefix = '' then
    raise exception 'Document prefix is required';
  end if;

  v_base := v_prefix || to_char(coalesce(p_document_date, current_date), 'YYYYMMDD');
  perform pg_advisory_xact_lock(hashtext(v_base));

  select coalesce(max(right(document_no, 4)::integer), 0) + 1
  into v_next
  from (
    select order_no as document_no from public.pur_orders where order_no like v_base || '%'
    union all select receipt_no from public.pur_receipts where receipt_no like v_base || '%'
    union all select return_no from public.pur_returns where return_no like v_base || '%'
    union all select order_no from public.sal_orders where order_no like v_base || '%'
    union all select delivery_no from public.sal_deliveries where delivery_no like v_base || '%'
    union all select return_no from public.sal_returns where return_no like v_base || '%'
    union all select adjustment_no from public.inv_adjustments where adjustment_no like v_base || '%'
    union all select stocktake_no from public.inv_stocktakes where stocktake_no like v_base || '%'
    union all select transfer_no from public.inv_transfers where transfer_no like v_base || '%'
    union all select transaction_no from public.inv_transactions where transaction_no like v_base || '%'
    union all select receivable_no from public.fin_receivables where receivable_no like v_base || '%'
    union all select payable_no from public.fin_payables where payable_no like v_base || '%'
  ) documents
  where document_no ~ (v_base || '[0-9]{4}$');

  return v_base || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.erp_require_permission(p_permission_code text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not (public.erp_is_super_admin() or public.erp_has_permission(p_permission_code)) then
    raise exception 'Missing permission: %', p_permission_code using errcode = '42501';
  end if;
end;
$$;

-- Internal primitive. It locks the stock dimension, updates on-hand/available balance
-- and writes exactly one inventory transaction. It is intentionally not callable by clients.
create or replace function public.erp_apply_stock_change(
  p_transaction_type text,
  p_direction text,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_batch_no text,
  p_qty numeric,
  p_unit_cost numeric default 0,
  p_source_type text default null,
  p_source_id uuid default null,
  p_source_no text default null,
  p_remark text default null,
  p_production_date date default null,
  p_expiry_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_stock public.inv_stocks%rowtype;
  v_stock_id uuid;
  v_normalized_batch text := nullif(btrim(coalesce(p_batch_no, '')), '');
  v_before_qty numeric(18,6) := 0;
  v_after_qty numeric(18,6);
  v_old_cost numeric(18,4) := 0;
  v_new_cost numeric(18,4) := 0;
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

  -- Serialize a nullable stock dimension before selecting/inserting it.
  perform pg_advisory_xact_lock(
    hashtext(
      p_product_id::text || ':' || p_warehouse_id::text || ':' ||
      coalesce(p_location_id::text, '') || ':' || coalesce(v_normalized_batch, '')
    )
  );

  select *
  into v_stock
  from public.inv_stocks
  where product_id = p_product_id
    and warehouse_id = p_warehouse_id
    and location_id is not distinct from p_location_id
    and batch_no is not distinct from v_normalized_batch
  for update;

  select allow_negative_stock
  into v_allow_negative
  from public.base_warehouses
  where id = p_warehouse_id;

  if not found then
    raise exception 'Warehouse does not exist';
  end if;

  if found and v_stock.id is not null then
    v_stock_id := v_stock.id;
    v_before_qty := v_stock.quantity_on_hand;
    v_old_cost := v_stock.unit_cost;
  end if;

  if p_direction = 'in' then
    v_after_qty := v_before_qty + p_qty;
    v_new_cost := case
      when v_before_qty <= 0 then round(coalesce(p_unit_cost, 0), 4)
      when coalesce(p_unit_cost, 0) <= 0 then v_old_cost
      else round(((v_before_qty * v_old_cost) + (p_qty * p_unit_cost)) / v_after_qty, 4)
    end;
  else
    v_after_qty := v_before_qty - p_qty;
    if v_after_qty < 0 and not coalesce(v_allow_negative, false) then
      raise exception 'Insufficient stock: product %, warehouse %, location %, batch %; available %',
        p_product_id, p_warehouse_id, coalesce(p_location_id::text, '-'), coalesce(v_normalized_batch, '-'), v_before_qty;
    end if;
    v_new_cost := case when v_old_cost > 0 then v_old_cost else round(coalesce(p_unit_cost, 0), 4) end;
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
    )
    returning id into v_stock_id;
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

  v_amount := round(p_qty * coalesce(nullif(p_unit_cost, 0), v_new_cost), 2);
  v_sys_user_id := public.erp_current_sys_user_id();

  insert into public.inv_transactions (
    transaction_no, transaction_type, direction, product_id, warehouse_id, location_id,
    batch_no, stock_id, qty, unit_cost, amount, before_qty, after_qty,
    source_type, source_id, source_no, operator_user_id, remark
  ) values (
    public.erp_next_document_no('TX', current_date), p_transaction_type, p_direction,
    p_product_id, p_warehouse_id, p_location_id, v_normalized_batch, v_stock_id,
    p_qty, coalesce(nullif(p_unit_cost, 0), v_new_cost), v_amount, v_before_qty, v_after_qty,
    p_source_type, p_source_id, p_source_no, v_sys_user_id, p_remark
  );

  return v_stock_id;
end;
$$;

-- Posts an approved/submitted stock-affecting document in one database transaction.
-- Repeated post requests are idempotent: a posted/completed document is simply returned.
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
  v_item record;
  v_paid_due date;
  v_amount numeric(18,2);
  v_loss_amount numeric(18,2);
  v_status text;
begin
  if p_source_id is null then
    raise exception 'Document id is required';
  end if;

  case p_source_type
    when 'purchase_receipt' then
      perform public.erp_require_permission('purchase:receipt:approve');
      select * into v_receipt from public.pur_receipts where id = p_source_id for update;
      if not found then raise exception 'Purchase receipt does not exist'; end if;
      if v_receipt.status = 'posted' then return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id); end if;
      if v_receipt.status = 'cancelled' then raise exception 'Cancelled receipt cannot be posted'; end if;

      for v_item in select * from public.pur_receipt_items where receipt_id = p_source_id order by line_no loop
        perform public.erp_apply_stock_change(
          'purchase_receipt', 'in', v_item.product_id, v_receipt.warehouse_id, v_item.location_id,
          v_item.batch_no, v_item.qty, v_item.unit_price, 'purchase_receipt', v_receipt.id, v_receipt.receipt_no,
          v_item.remark, v_item.production_date, v_item.expiry_date
        );

        if v_item.order_item_id is not null then
          update public.pur_order_items
          set received_qty = least(qty, received_qty + v_item.qty)
          where id = v_item.order_item_id;
        end if;
      end loop;

      if v_receipt.order_id is not null then
        select case
          when bool_and(received_qty >= qty) then 'completed'
          when bool_or(received_qty > 0) then 'partial_received'
          else 'approved'
        end
        into v_status
        from public.pur_order_items
        where order_id = v_receipt.order_id;

        update public.pur_orders set status = coalesce(v_status, status) where id = v_receipt.order_id;
      end if;

      select v_receipt.receipt_date + s.payment_term_days
      into v_paid_due
      from public.base_suppliers s where s.id = v_receipt.supplier_id;

      if not exists (
        select 1 from public.fin_payables
        where source_type = 'purchase_receipt' and source_id = v_receipt.id and status <> 'cancelled'
      ) then
        insert into public.fin_payables (
          payable_no, supplier_id, source_type, source_id, source_no, bill_date, due_date,
          original_amount, paid_amount, outstanding_amount, writeoff_amount, status, remark
        ) values (
          public.erp_next_document_no('AP', v_receipt.receipt_date), v_receipt.supplier_id,
          'purchase_receipt', v_receipt.id, v_receipt.receipt_no, v_receipt.receipt_date, v_paid_due,
          v_receipt.total_amount, 0, v_receipt.total_amount, 0,
          case when v_paid_due < current_date then 'overdue' else 'open' end,
          '由采购收货单自动生成'
        );
      end if;

      update public.pur_receipts set status = 'posted', posted_at = now() where id = v_receipt.id;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);

    when 'purchase_return' then
      perform public.erp_require_permission('purchase:return:approve');
      select * into v_purchase_return from public.pur_returns where id = p_source_id for update;
      if not found then raise exception 'Purchase return does not exist'; end if;
      if v_purchase_return.status = 'posted' then return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id); end if;
      if v_purchase_return.status = 'cancelled' then raise exception 'Cancelled purchase return cannot be posted'; end if;

      for v_item in select * from public.pur_return_items where return_id = p_source_id order by line_no loop
        perform public.erp_apply_stock_change(
          'purchase_return', 'out', v_item.product_id, v_purchase_return.warehouse_id, v_item.location_id,
          v_item.batch_no, v_item.qty, v_item.unit_price, 'purchase_return', v_purchase_return.id,
          v_purchase_return.return_no, v_item.remark
        );
      end loop;

      update public.pur_returns set status = 'posted' where id = v_purchase_return.id;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);

    when 'sales_delivery' then
      perform public.erp_require_permission('sales:delivery:approve');
      select * into v_delivery from public.sal_deliveries where id = p_source_id for update;
      if not found then raise exception 'Sales delivery does not exist'; end if;
      if v_delivery.status = 'posted' then return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id); end if;
      if v_delivery.status = 'cancelled' then raise exception 'Cancelled delivery cannot be posted'; end if;

      for v_item in select * from public.sal_delivery_items where delivery_id = p_source_id order by line_no loop
        perform public.erp_apply_stock_change(
          'sales_delivery', 'out', v_item.product_id, v_delivery.warehouse_id, v_item.location_id,
          v_item.batch_no, v_item.qty, v_item.unit_price, 'sales_delivery', v_delivery.id,
          v_delivery.delivery_no, v_item.remark
        );

        if v_item.order_item_id is not null then
          update public.sal_order_items
          set delivered_qty = least(qty, delivered_qty + v_item.qty)
          where id = v_item.order_item_id;
        end if;
      end loop;

      if v_delivery.order_id is not null then
        select case
          when bool_and(delivered_qty >= qty) then 'completed'
          when bool_or(delivered_qty > 0) then 'partial_delivered'
          else 'approved'
        end
        into v_status
        from public.sal_order_items
        where order_id = v_delivery.order_id;
        update public.sal_orders set status = coalesce(v_status, status) where id = v_delivery.order_id;
      end if;

      if not exists (
        select 1 from public.fin_receivables
        where source_type = 'sales_delivery' and source_id = v_delivery.id and status <> 'cancelled'
      ) then
        select v_delivery.delivery_date + c.payment_term_days
        into v_paid_due
        from public.base_customers c where c.id = v_delivery.customer_id;

        insert into public.fin_receivables (
          receivable_no, customer_id, source_type, source_id, source_no, bill_date, due_date,
          original_amount, received_amount, outstanding_amount, writeoff_amount, status, remark
        ) values (
          public.erp_next_document_no('AR', v_delivery.delivery_date), v_delivery.customer_id,
          'sales_delivery', v_delivery.id, v_delivery.delivery_no, v_delivery.delivery_date, v_paid_due,
          v_delivery.total_amount, 0, v_delivery.total_amount, 0,
          case when v_paid_due < current_date then 'overdue' else 'open' end,
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
      if v_sales_return.status = 'posted' then return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id); end if;
      if v_sales_return.status = 'cancelled' then raise exception 'Cancelled sales return cannot be posted'; end if;

      for v_item in select * from public.sal_return_items where return_id = p_source_id order by line_no loop
        if v_item.quality_status <> 'rejected' then
          perform public.erp_apply_stock_change(
            'sales_return', 'in', v_item.product_id, v_sales_return.warehouse_id, v_item.location_id,
            v_item.batch_no, v_item.qty, v_item.unit_price, 'sales_return', v_sales_return.id,
            v_sales_return.return_no, v_item.remark
          );
        end if;
      end loop;

      update public.base_customers
      set credit_used = greatest(credit_used - v_sales_return.total_amount, 0)
      where id = v_sales_return.customer_id;

      update public.sal_returns set status = 'posted' where id = v_sales_return.id;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);

    when 'adjustment' then
      perform public.erp_require_permission('inventory:adjustment:approve');
      select * into v_adjustment from public.inv_adjustments where id = p_source_id for update;
      if not found then raise exception 'Inventory adjustment does not exist'; end if;
      if v_adjustment.status = 'posted' then return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id); end if;
      if v_adjustment.status = 'cancelled' then raise exception 'Cancelled adjustment cannot be posted'; end if;

      for v_item in select * from public.inv_adjustment_items where adjustment_id = p_source_id order by line_no loop
        perform public.erp_apply_stock_change(
          case when v_adjustment.adjustment_type = 'gain' then 'adjustment_gain' else 'adjustment_loss' end,
          case when v_adjustment.adjustment_type = 'gain' then 'in' else 'out' end,
          v_item.product_id, v_adjustment.warehouse_id, v_item.location_id, v_item.batch_no,
          v_item.adjustment_qty, v_item.unit_cost, 'adjustment', v_adjustment.id, v_adjustment.adjustment_no,
          coalesce(v_item.reason, v_adjustment.reason)
        );
      end loop;

      update public.inv_adjustments set status = 'posted' where id = v_adjustment.id;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);

    when 'stocktake' then
      perform public.erp_require_permission('inventory:stocktake:approve');
      select * into v_stocktake from public.inv_stocktakes where id = p_source_id for update;
      if not found then raise exception 'Stocktake does not exist'; end if;
      if v_stocktake.status = 'posted' then return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id); end if;
      if v_stocktake.status = 'cancelled' then raise exception 'Cancelled stocktake cannot be posted'; end if;

      for v_item in
        select * from public.inv_stocktake_items
        where stocktake_id = p_source_id
          and actual_qty is not null
          and difference_qty <> 0
        order by line_no
      loop
        perform public.erp_apply_stock_change(
          case when v_item.difference_qty > 0 then 'stocktake_gain' else 'stocktake_loss' end,
          case when v_item.difference_qty > 0 then 'in' else 'out' end,
          v_item.product_id, v_stocktake.warehouse_id, v_item.location_id, v_item.batch_no,
          abs(v_item.difference_qty), v_item.unit_cost, 'stocktake', v_stocktake.id, v_stocktake.stocktake_no,
          v_item.remark
        );
      end loop;

      select
        coalesce(sum(case when difference_amount > 0 then difference_amount else 0 end), 0),
        coalesce(abs(sum(case when difference_amount < 0 then difference_amount else 0 end)), 0)
      into v_amount, v_loss_amount
      from public.inv_stocktake_items
      where stocktake_id = p_source_id;

      update public.inv_stocktakes
      set status = 'posted',
          gain_amount = coalesce(v_amount, 0),
          loss_amount = coalesce(v_loss_amount, 0)
      where id = v_stocktake.id;

      update public.inv_stocktake_items set status = 'posted' where stocktake_id = v_stocktake.id and actual_qty is not null;
      return jsonb_build_object('success', true, 'status', 'posted', 'document_id', p_source_id);

    when 'transfer' then
      perform public.erp_require_permission('inventory:transfer:approve');
      select * into v_transfer from public.inv_transfers where id = p_source_id for update;
      if not found then raise exception 'Transfer does not exist'; end if;
      if v_transfer.status = 'completed' then return jsonb_build_object('success', true, 'status', 'completed', 'document_id', p_source_id); end if;
      if v_transfer.status = 'cancelled' then raise exception 'Cancelled transfer cannot be posted'; end if;

      for v_item in select * from public.inv_transfer_items where transfer_id = p_source_id order by line_no loop
        perform public.erp_apply_stock_change(
          'transfer_out', 'out', v_item.product_id, v_transfer.from_warehouse_id, v_item.from_location_id,
          v_item.batch_no, v_item.qty, v_item.unit_cost, 'transfer', v_transfer.id, v_transfer.transfer_no,
          v_item.remark
        );
        perform public.erp_apply_stock_change(
          'transfer_in', 'in', v_item.product_id, v_transfer.to_warehouse_id, v_item.to_location_id,
          v_item.batch_no, v_item.qty, v_item.unit_cost, 'transfer', v_transfer.id, v_transfer.transfer_no,
          v_item.remark
        );
      end loop;

      update public.inv_transfer_items set outbound_qty = qty, inbound_qty = qty where transfer_id = v_transfer.id;
      update public.inv_transfers
      set status = 'completed', outbound_at = now(), inbound_at = now()
      where id = v_transfer.id;
      return jsonb_build_object('success', true, 'status', 'completed', 'document_id', p_source_id);

    else
      raise exception 'Unsupported source type: %', p_source_type;
  end case;
end;
$$;

-- Builds a draft stocktake's rows from current stock, keeping each dimension (product/location/batch).
create or replace function public.erp_prepare_stocktake_items(p_stocktake_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_header public.inv_stocktakes%rowtype;
  v_count integer;
begin
  perform public.erp_require_permission('inventory:stocktake:update');

  select * into v_header
  from public.inv_stocktakes
  where id = p_stocktake_id
  for update;

  if not found then raise exception 'Stocktake does not exist'; end if;
  if v_header.status not in ('draft', 'in_progress') then
    raise exception 'Only draft or in-progress stocktake can be prepared';
  end if;

  delete from public.inv_stocktake_items where stocktake_id = v_header.id and status = 'pending';

  insert into public.inv_stocktake_items (
    stocktake_id, line_no, product_id, unit_id, location_id, batch_no, book_qty, unit_cost, status
  )
  select
    v_header.id,
    row_number() over (order by p.code, coalesce(l.code, ''), coalesce(s.batch_no, ''))::integer,
    s.product_id,
    p.base_unit_id,
    s.location_id,
    s.batch_no,
    s.quantity_on_hand,
    s.unit_cost,
    'pending'
  from public.inv_stocks s
  join public.base_products p on p.id = s.product_id
  left join public.base_warehouse_locations l on l.id = s.location_id
  where s.warehouse_id = v_header.warehouse_id
    and s.status = 'active'
    and (v_header.category_id is null or p.category_id = v_header.category_id);

  get diagnostics v_count = row_count;
  update public.inv_stocktakes set status = 'in_progress' where id = v_header.id;
  return v_count;
end;
$$;

-- Useful for sales stock checks and product-selector side panels.
create or replace function public.erp_product_stock_summary(p_product_id uuid)
returns table (
  warehouse_id uuid,
  warehouse_code text,
  warehouse_name text,
  quantity_on_hand numeric,
  quantity_available numeric
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    s.warehouse_id,
    w.code::text,
    w.name::text,
    coalesce(sum(s.quantity_on_hand), 0),
    coalesce(sum(s.quantity_available), 0)
  from public.inv_stocks s
  join public.base_warehouses w on w.id = s.warehouse_id
  where s.product_id = p_product_id
    and s.status = 'active'
  group by s.warehouse_id, w.code, w.name
  order by w.code;
$$;

-- Realtime is optional at runtime. The exception handlers keep this migration safe
-- on projects where publication management is restricted.
do $$
begin
  begin
    alter publication supabase_realtime add table public.inv_stocks;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when insufficient_privilege then null;
  end;
end;
$$;

revoke all on function public.erp_current_sys_user_id() from public;
revoke all on function public.erp_next_document_no(text, date) from public;
revoke all on function public.erp_require_permission(text) from public;
revoke all on function public.erp_apply_stock_change(text, text, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, text, date, date) from public;
revoke all on function public.erp_post_inventory(text, uuid) from public;
revoke all on function public.erp_prepare_stocktake_items(uuid) from public;
revoke all on function public.erp_product_stock_summary(uuid) from public;

grant execute on function public.erp_next_document_no(text, date) to authenticated;
grant execute on function public.erp_post_inventory(text, uuid) to authenticated;
grant execute on function public.erp_prepare_stocktake_items(uuid) to authenticated;
grant execute on function public.erp_product_stock_summary(uuid) to authenticated;

commit;
