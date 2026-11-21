create or replace function public.set_administrator(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  who text;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only the shop owner can change the administrator role'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if exists(select 1 from public.user_roles where user_id = p_user_id and role = 'admin') then
    raise exception 'The owner role cannot be changed here';
  end if;
  if not exists(select 1 from public.profiles where id = p_user_id) then raise exception 'Staff account not found'; end if;
  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles(user_id, role)
    values (p_user_id, case when p_enabled then 'administrator'::public.app_role else 'cashier'::public.app_role end);
  who := coalesce((select display_name from public.profiles where id = p_user_id), 'Staff');
  insert into public.audit_events(actor_id, actor_name, branch_id, category, action, description, record_id)
    values (auth.uid(), coalesce((select display_name from public.profiles where id = auth.uid()), 'Owner'), null,
            'Staff', case when p_enabled then 'Granted administrator' else 'Revoked administrator' end,
            (case when p_enabled then 'Made ' else 'Removed administrator access from ' end) || who, p_user_id::text);
end
$function$;

revoke execute on function public.set_administrator(uuid, boolean) from anon;
grant execute on function public.set_administrator(uuid, boolean) to authenticated;