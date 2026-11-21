create or replace function public.factory_reset()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only the shop owner can run a factory reset'; end if;
  owner := auth.uid();
  perform pg_advisory_xact_lock(882233);

  delete from public.sale_reversal_items;
  delete from public.sale_reversals;
  delete from public.sale_costs;
  delete from public.sale_items;
  delete from public.sales;
  delete from public.loan_installments;
  delete from public.loan_payments;
  delete from public.loan_term_revisions;
  delete from public.loans;
  delete from public.repair_job_events;
  delete from public.repair_jobs;
  delete from public.job_types;
  delete from public.cheque_reminders;
  delete from public.reminders;
  delete from public.capital_movements;
  delete from public.petty_cash_entries;
  delete from public.petty_cash_categories;
  delete from public.expense_staff;
  delete from public.fx_entries;
  delete from public.fx_accounts;
  delete from public.fx_currencies;
  delete from public.old_gold_entries;
  delete from public.old_gold_movements;
  delete from public.old_gold_accounts;
  delete from public.stock_movements;
  delete from public.item_costs;
  delete from public.items;
  delete from public.daily_rates;
  delete from public.customers;
  delete from public.suppliers;
  delete from public.stock_categories;
  delete from public.operation_requests;
  delete from public.staff_access;
  delete from public.staff_roles;
  delete from public.profiles where id <> owner;
  delete from public.user_roles where user_id <> owner;
  delete from public.audit_events;

  perform setval('tag_seq', 1, false);
  perform setval('system_tag_seq', 1, false);
  perform setval('invoice_seq', 1, false);
  perform setval('loan_seq', 1, false);
  perform setval('receipt_seq', 1, false);
  perform setval('repair_job_seq', 1, false);

  insert into public.audit_events(actor_id, actor_name, branch_id, category, action, description)
  values (owner, coalesce((select display_name from public.profiles where id = owner), 'Owner'), null, 'Factory reset', 'Factory reset', 'All shop records were cleared by the owner; the owner login and shop settings were kept.');
end
$function$;

revoke execute on function public.factory_reset() from anon;
grant execute on function public.factory_reset() to authenticated;