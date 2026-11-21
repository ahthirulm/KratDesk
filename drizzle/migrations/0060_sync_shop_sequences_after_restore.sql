create or replace function public.sync_shop_sequences()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  n bigint;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Owner access required'; end if;

  select coalesce(max(nullif(split_part(tag_id,'-',2),'')::int),0) into n from public.items;
  perform setval('tag_seq', n + 1, false);

  select coalesce(max(nullif(split_part(system_tag,'-',2),'')::int),0) into n from public.items;
  perform setval('system_tag_seq', n + 1, false);

  select coalesce(max(nullif(split_part(invoice_no,'-',2),'')::int),0) into n from public.sales;
  perform setval('invoice_seq', n + 1, false);

  select coalesce(max(nullif(split_part(loan_no,'-',2),'')::int),0) into n from public.loans;
  perform setval('loan_seq', n + 1, false);

  select coalesce(max(nullif(split_part(receipt_no,'-',2),'')::int),0) into n from public.loan_payments where receipt_no is not null;
  perform setval('receipt_seq', n + 1, false);

  select coalesce(max(nullif(split_part(job_no,'RJ',2),'')::int),0) into n from public.repair_jobs;
  perform setval('repair_job_seq', n + 1, false);
end
$function$;

revoke execute on function public.sync_shop_sequences() from anon;
grant execute on function public.sync_shop_sequences() to authenticated;