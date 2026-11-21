CREATE OR REPLACE FUNCTION public.record_petty_cash(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE b text:=p->>'branch_id';k text:=p->>'kind';a numeric:=(p->>'amount')::numeric;eid uuid;existing uuid;
BEGIN
 IF NOT public.staff_can('Manage expenses',b) THEN RAISE EXCEPTION 'Expense management permission required';END IF;
 existing:=public.operation_begin(p,'petty-cash');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF k<>'Expense' THEN RAISE EXCEPTION 'Top-ups are not available; record shop receipts in main cash instead';END IF;
 IF a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) OR nullif(trim(p->>'description'),'') IS NULL OR length(trim(p->>'description'))>500 THEN RAISE EXCEPTION 'Enter a valid amount and description';END IF;
 a:=round(a,2);PERFORM pg_advisory_xact_lock(hashtextextended('petty-cash-'||b,0));
 INSERT INTO public.petty_cash_entries(branch_id,kind,amount,category,description,reference,created_by) VALUES(b,k,a,coalesce(nullif(trim(p->>'category'),''),'Other'),trim(p->>'description'),trim(coalesce(p->>'reference','')),auth.uid()) RETURNING id INTO eid;
 PERFORM public.branch_cash_change(b,-a);
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Spent','Spent '||to_char(a,'FM999,999,999,999,990.00')||' — '||trim(p->>'description'),eid::text);
 PERFORM public.operation_finish(p,'petty-cash',eid);RETURN eid;
END $function$;