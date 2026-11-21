-- Administrator role + branch/data-scoped reset

alter type public.app_role add value if not exists 'administrator';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text in ('admin','administrator')
  );
$$;

revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- Access rules that used to accept the owner only now accept both admin roles.
drop policy if exists audit_owner_read on public.audit_events;
create policy audit_owner_read on public.audit_events for select to authenticated using (public.is_admin());

drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches for select to authenticated using (
  public.is_admin() or exists(
    select 1 from public.staff_access a
    where a.user_id = auth.uid() and a.active and branches.id = any(a.branch_ids)));

drop policy if exists rates_admin on public.daily_rates;
create policy rates_admin on public.daily_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists metals_admin on public.metal_types;
create policy metals_admin on public.metal_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin());

drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists staff_access_read on public.staff_access;
create policy staff_access_read on public.staff_access for select to authenticated using (
  user_id = auth.uid() or public.is_admin());

drop policy if exists staff_roles_read on public.staff_roles;
create policy staff_roles_read on public.staff_roles for select to authenticated using (
  public.is_admin() or exists(
    select 1 from public.staff_access a
    where a.user_id = auth.uid() and a.active and a.role_id = staff_roles.id));

drop policy if exists categories_read on public.stock_categories;
create policy categories_read on public.stock_categories for select to authenticated using (
  public.is_admin() or public.has_role(auth.uid(), 'cashier'));

drop policy if exists stock_movements_read on public.stock_movements;
create policy stock_movements_read on public.stock_movements for select to authenticated using (
  public.is_admin() or exists(
    select 1 from public.staff_access a
    where a.user_id = auth.uid() and a.active
      and (stock_movements.from_branch = any(a.branch_ids) or stock_movements.to_branch = any(a.branch_ids))));

drop policy if exists own_roles on public.user_roles;
create policy own_roles on public.user_roles for select to authenticated using (
  user_id = auth.uid() or public.is_admin());

-- Server functions that used to accept the owner only now accept both admin
-- roles. Bodies are rewritten in place so nothing else about them changes.
do $$
declare
  r record;
  body text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('log_security_action','login_access','manage_fx_currency','manage_job_type',
                        'manage_metal','owner_cash_allowed','repair_job_action','save_branch',
                        'save_staff_access','save_staff_role','set_staff_two_factor','staff_can')
  loop
    body := pg_get_functiondef(r.oid);
    body := replace(body, 'public.has_role(auth.uid(),''admin'')', 'public.is_admin()');
    body := replace(body, 'public.has_role(auth.uid(), ''admin'')', 'public.is_admin()');
    body := replace(body, 'public.has_role(uid,''admin'')', 'public.is_admin()');
    if r.proname in ('login_access','staff_can') then
      body := replace(body, 'role=''admin''', 'role::text in (''admin'',''administrator'')');
    end if;
    if r.proname = 'save_staff_role' then
      body := replace(body, 'lower(trim(p->>''name''))=''super admin''',
                            'lower(trim(p->>''name'')) in (''super admin'',''administrator'')');
    end if;
    execute body;
  end loop;
end
$$;

-- Reset with choices: which branches, which data. Owner login always survives.
drop function if exists public.factory_reset();

create or replace function public.factory_reset(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  owner uuid;
  bs text[];
  gs text[];
  every_branch boolean;
  allowed text[] := array['stock','sales','loans','jobs','customers','money','reminders','directories','rates','staff','audit'];
  wide text[] := array['customers','directories','rates','staff'];
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only the shop owner can run a reset'; end if;
  owner := auth.uid();
  perform pg_advisory_xact_lock(882233);

  select coalesce(array_agg(distinct b), '{}') into bs
    from jsonb_array_elements_text(coalesce(p->'branches','[]'::jsonb)) b;
  select coalesce(array_agg(distinct g), '{}') into gs
    from jsonb_array_elements_text(coalesce(p->'groups','[]'::jsonb)) g;

  if cardinality(bs) = 0 then raise exception 'Choose at least one branch to reset'; end if;
  if cardinality(gs) = 0 then raise exception 'Choose what to reset'; end if;
  if not gs <@ allowed then raise exception 'Unknown reset option'; end if;
  if exists(select 1 from unnest(bs) b where not exists(select 1 from public.branches where id = b)) then
    raise exception 'Unknown branch';
  end if;
  every_branch := (select count(*) from public.branches) = cardinality(bs);
  if not every_branch and exists(select 1 from unnest(gs) g where g = any(wide)) then
    raise exception 'Customers, directories, rates and staff are shop-wide — select every branch to reset them';
  end if;

  -- Reminders first: cheque rows point at bills and repayments.
  if 'reminders' = any(gs) then
    delete from public.reminders where branch_id = any(bs);
    delete from public.cheque_reminders where branch_id = any(bs);
  end if;

  if 'sales' = any(gs) then
    delete from public.cheque_reminders where sale_id in (select id from public.sales where branch_id = any(bs));
    delete from public.sale_reversal_items where reversal_id in (select id from public.sale_reversals where branch_id = any(bs));
    delete from public.sale_reversals where branch_id = any(bs);
    delete from public.sale_costs where sale_item_id in (
      select si.id from public.sale_items si join public.sales s on s.id = si.sale_id where s.branch_id = any(bs));
    delete from public.sale_items where sale_id in (select id from public.sales where branch_id = any(bs));
    delete from public.sales where branch_id = any(bs);
    update public.items set status = 'In Stock', sold_invoice = null
      where branch_id = any(bs) and status = 'Sold'
        and id not in (select item_id from public.sale_items);
  end if;

  if 'loans' = any(gs) then
    delete from public.cheque_reminders where payment_id in (
      select id from public.loan_payments where branch_id = any(bs));
    delete from public.loan_term_revisions where loan_id in (select id from public.loans where branch_id = any(bs));
    delete from public.loan_installments where loan_id in (select id from public.loans where branch_id = any(bs));
    delete from public.loan_payments where branch_id = any(bs);
    delete from public.loans where branch_id = any(bs);
  end if;

  if 'jobs' = any(gs) then
    delete from public.repair_job_events where job_id in (select id from public.repair_jobs where branch_id = any(bs));
    delete from public.repair_jobs where branch_id = any(bs);
    if every_branch then delete from public.job_types; end if;
  end if;

  if 'money' = any(gs) then
    delete from public.petty_cash_entries where branch_id = any(bs);
    delete from public.petty_cash_categories where branch_id = any(bs);
    delete from public.capital_movements where branch_id = any(bs);
    delete from public.fx_entries where branch_id = any(bs);
    delete from public.fx_accounts where branch_id = any(bs);
    delete from public.old_gold_entries where branch_id = any(bs);
    delete from public.old_gold_movements where from_branch = any(bs) or to_branch = any(bs);
    delete from public.old_gold_accounts where branch_id = any(bs);
    delete from public.expense_staff es where es.branch_id = any(bs)
      and not exists(select 1 from public.repair_jobs rj where rj.repairer_id = es.id);
  end if;

  if 'stock' = any(gs) then
    if exists(select 1 from public.items i where i.branch_id = any(bs)
                and exists(select 1 from public.sale_items si where si.item_id = i.id)) then
      raise exception 'Stock still appears on bills. Reset sales for these branches as well.';
    end if;
    delete from public.stock_movements where from_branch = any(bs) or to_branch = any(bs);
    delete from public.item_costs where item_id in (select id from public.items where branch_id = any(bs));
    delete from public.items where branch_id = any(bs);
  end if;

  if 'customers' = any(gs) then
    delete from public.customers c
      where not exists(select 1 from public.sales s where s.customer_id = c.id)
        and not exists(select 1 from public.loans l where l.customer_id = c.id)
        and not exists(select 1 from public.repair_jobs rj where rj.customer_id = c.id);
  end if;

  if 'directories' = any(gs) then
    delete from public.suppliers;
    delete from public.stock_categories;
  end if;

  if 'rates' = any(gs) then
    delete from public.daily_rates;
  end if;

  if 'staff' = any(gs) then
    delete from public.staff_access where user_id <> owner;
    delete from public.staff_roles;
    delete from public.user_roles where user_id <> owner;
    delete from public.profiles where id <> owner;
  end if;

  if 'audit' = any(gs) then
    delete from public.audit_events where branch_id = any(bs) or (every_branch and branch_id is null);
  end if;

  -- Numbering restarts only when nothing of that kind is left anywhere.
  if every_branch then
    if 'stock' = any(gs) then perform setval('tag_seq', 1, false); perform setval('system_tag_seq', 1, false); end if;
    if 'sales' = any(gs) then perform setval('invoice_seq', 1, false); end if;
    if 'loans' = any(gs) then perform setval('loan_seq', 1, false); perform setval('receipt_seq', 1, false); end if;
    if 'jobs' = any(gs) then perform setval('repair_job_seq', 1, false); end if;
  end if;

  insert into public.audit_events(actor_id, actor_name, branch_id, category, action, description)
  values (owner, coalesce((select display_name from public.profiles where id = owner), 'Owner'), null, 'Factory reset', 'Factory reset',
          'Reset run by the owner · branches: '||array_to_string(bs, ', ')||' · data: '||array_to_string(gs, ', '));
end
$function$;

revoke execute on function public.factory_reset(p jsonb) from anon;
grant execute on function public.factory_reset(p jsonb) to authenticated;