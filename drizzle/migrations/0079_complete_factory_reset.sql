-- Complete KaratDesk installation reset.
-- Invoked only by the trusted server with the Supabase service role.
-- Preserves the migration ledger so the existing database schema remains current.

create or replace function public.factory_reset_everything()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  table_list text;
begin
  perform pg_advisory_xact_lock(882234);

  select string_agg(
    format('%I.%I', schemaname, tablename),
    ', '
    order by tablename
  )
  into table_list
  from pg_tables
  where schemaname = 'public'
    and tablename <> 'karatdesk_schema_migrations';

  if table_list is null then
    raise exception 'No KaratDesk tables were found';
  end if;

  execute 'truncate table ' || table_list || ' restart identity cascade';
end
$function$;

revoke all on function public.factory_reset_everything() from public;
revoke all on function public.factory_reset_everything() from anon;
revoke all on function public.factory_reset_everything() from authenticated;
grant execute on function public.factory_reset_everything() to service_role;
