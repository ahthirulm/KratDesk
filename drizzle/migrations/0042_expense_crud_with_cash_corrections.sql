CREATE OR REPLACE FUNCTION public.change_petty_expense(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
 b text:=nullif(trim(p->>'branch_id'),'');
 eid uuid:=nullif(p->>'id','')::uuid;
 action text:=p->>'action';
 e public.petty_cash_entries%ROWTYPE;
 a numeric;
 d date;
 cid uuid;
 n text;
 existing uuid;
BEGIN
 IF b IS NULL OR eid IS NULL OR action NOT IN ('Save','Delete') THEN RAISE EXCEPTION 'Choose a valid expense action';END IF;
 IF NOT public.staff_can('Manage expenses',b) THEN RAISE EXCEPTION 'Expense management permission required';END IF;
 existing:=public.operation_begin(p,'petty-expense-change');
 IF existing IS NOT NULL THEN RETURN existing;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('petty-cash-'||b,0));
 SELECT * INTO e FROM public.petty_cash_entries WHERE id=eid AND branch_id=b FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found in this branch';END IF;
 IF e.kind<>'Expense' THEN RAISE EXCEPTION 'Historical top-ups cannot be edited or deleted';END IF;
 IF action='Delete' THEN
  PERFORM public.branch_cash_change(b,e.amount);
  DELETE FROM public.petty_cash_entries WHERE id=e.id;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id)
  VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Deleted','Deleted expense '||to_char(e.amount,'FM999,999,999,999,990.00')||' — '||e.description||'; returned to main cash',e.id::text);
 ELSE
  a:=(p->>'amount')::numeric;
  d:=coalesce(nullif(p->>'date','')::date,e.date);
  IF a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) OR nullif(trim(p->>'description'),'') IS NULL OR length(trim(p->>'description'))>500 OR length(trim(coalesce(p->>'reference','')))>120 THEN RAISE EXCEPTION 'Enter a valid amount, description and reference';END IF;
  IF d>(now() AT TIME ZONE 'Asia/Colombo')::date THEN RAISE EXCEPTION 'Expense date cannot be in the future';END IF;
  SELECT id,name INTO cid,n FROM public.petty_cash_categories WHERE branch_id=b AND name=trim(p->>'category');
  IF cid IS NULL THEN RAISE EXCEPTION 'Choose an existing expense category';END IF;
  a:=round(a,2);
  PERFORM public.branch_cash_change(b,e.amount-a);
  UPDATE public.petty_cash_entries SET amount=a,category=n,category_id=cid,description=trim(p->>'description'),reference=trim(coalesce(p->>'reference','')),date=d WHERE id=e.id;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id)
  VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Updated','Updated expense '||e.description||' from '||to_char(e.amount,'FM999,999,999,999,990.00')||' to '||to_char(a,'FM999,999,999,999,990.00'),e.id::text);
 END IF;
 PERFORM public.operation_finish(p,'petty-expense-change',eid);
 RETURN eid;
END $function$;

REVOKE ALL ON FUNCTION public.change_petty_expense(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_petty_expense(jsonb) TO authenticated,service_role;