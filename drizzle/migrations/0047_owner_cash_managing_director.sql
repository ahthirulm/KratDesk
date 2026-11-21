CREATE OR REPLACE FUNCTION public.owner_cash_allowed(target_branch text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.staff_access a JOIN public.staff_roles r ON r.id=a.role_id WHERE a.user_id=auth.uid() AND a.active AND r.name='Managing Director' AND target_branch=ANY(a.branch_ids))
$$;
REVOKE ALL ON FUNCTION public.owner_cash_allowed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_cash_allowed(text) TO authenticated;
DROP POLICY capital_movements_admin_read ON public.capital_movements;
CREATE POLICY capital_movements_read ON public.capital_movements FOR SELECT TO authenticated USING (public.owner_cash_allowed(branch_id));
CREATE OR REPLACE FUNCTION public.record_capital_movement(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id'; k text:=p->>'kind'; a numeric; n text:=trim(coalesce(p->>'note','')); d date; bank numeric; nid uuid;
BEGIN
 IF NOT public.owner_cash_allowed(b) THEN RAISE EXCEPTION 'Only the owner or a Managing Director can record cash in or cash out';END IF;
 IF k NOT IN ('Owner cash in','Owner cash out','Bank deposit','Bank withdrawal') THEN RAISE EXCEPTION 'Choose a valid movement type';END IF;
 BEGIN a:=(p->>'amount')::numeric; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Enter a valid amount';END;
 IF a IS NULL OR a<=0 OR a>1000000000000 OR a<>round(a,2) THEN RAISE EXCEPTION 'Enter a valid amount';END IF;
 IF length(n)>300 THEN RAISE EXCEPTION 'Note is too long';END IF;
 d:=coalesce(nullif(p->>'date','')::date,(now() AT TIME ZONE 'Asia/Colombo')::date);
 IF d>(now() AT TIME ZONE 'Asia/Colombo')::date THEN RAISE EXCEPTION 'Date cannot be in the future';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('capital-'||coalesce(b,''),0));
 IF k='Bank withdrawal' THEN
  SELECT coalesce(sum(CASE WHEN kind='Bank deposit' THEN amount ELSE -amount END),0) INTO bank FROM public.capital_movements WHERE branch_id=b AND kind IN('Bank deposit','Bank withdrawal');
  IF a>bank THEN RAISE EXCEPTION 'Bank balance is not enough for this withdrawal';END IF;
 END IF;
 PERFORM public.branch_cash_change(b,CASE WHEN k IN('Owner cash in','Bank withdrawal') THEN a ELSE -a END);
 INSERT INTO public.capital_movements(branch_id,kind,amount,note,date,created_by) VALUES(b,k,a,n,d,auth.uid()) RETURNING id INTO nid;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id)
 VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Owner cash','Recorded',k||' '||to_char(a,'FM999,999,999,999,990.00')||CASE WHEN n<>'' THEN ' — '||n ELSE '' END,nid::text);
 RETURN nid;
END $$;