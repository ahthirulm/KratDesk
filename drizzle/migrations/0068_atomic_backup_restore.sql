CREATE OR REPLACE FUNCTION public.kd_restore_records(p_plans jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE plan jsonb; t text; c text; permitted text; cols text; total integer:=0; affected integer; pair text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only the shop owner can restore a backup'; END IF;
 IF jsonb_typeof(p_plans)<>'array' OR jsonb_array_length(p_plans)>31 THEN RAISE EXCEPTION 'Invalid restore plan'; END IF;
 PERFORM pg_advisory_xact_lock(882234);
 FOR plan IN SELECT value FROM jsonb_array_elements(p_plans) LOOP
  t:=plan->>'table'; c:=plan->>'column'; pair:=t||':'||c;
  IF pair<>ALL(ARRAY['daily_rates:date','stock_categories:name','suppliers:id','customers:id','job_types:name','items:branch_id','item_costs:item_id','stock_movements:from_branch','sales:branch_id','sale_items:sale_id','sale_costs:sale_item_id','sale_reversals:branch_id','sale_reversal_items:reversal_id','loans:branch_id','loan_installments:loan_id','loan_payments:branch_id','loan_term_revisions:loan_id','cheque_reminders:branch_id','reminders:branch_id','petty_cash_categories:branch_id','expense_staff:branch_id','petty_cash_entries:branch_id','capital_movements:branch_id','fx_accounts:branch_id','fx_entries:branch_id','old_gold_accounts:branch_id','old_gold_entries:branch_id','old_gold_movements:from_branch','repair_jobs:branch_id','repair_job_events:branch_id','audit_events:branch_id']) OR pair IS NULL THEN RAISE EXCEPTION 'Unsupported restore table'; END IF;
  IF jsonb_typeof(plan->'rows')<>'array' OR jsonb_typeof(plan->'values')<>'array' THEN RAISE EXCEPTION 'Invalid restore records'; END IF;
  IF coalesce((plan->>'clearAll')::boolean,false) AND t<>ALL(ARRAY['daily_rates','stock_categories','suppliers','customers','job_types','audit_events']) THEN RAISE EXCEPTION 'Invalid restore scope'; END IF;
  total:=total+jsonb_array_length(plan->'rows');
 END LOOP;
 IF total>200000 THEN RAISE EXCEPTION 'This backup is too large to restore in one go'; END IF;
 FOR plan IN SELECT value FROM jsonb_array_elements(p_plans) WITH ORDINALITY AS e(value,n) ORDER BY n DESC LOOP
  t:=plan->>'table';c:=plan->>'column';
  IF coalesce((plan->>'clearAll')::boolean,false) THEN EXECUTE format('DELETE FROM public.%I',t);
  ELSIF jsonb_array_length(plan->'values')>0 THEN EXECUTE format('DELETE FROM public.%I WHERE %I::text IN (SELECT jsonb_array_elements_text($1))',t,c) USING plan->'values'; END IF;
 END LOOP;
 FOR plan IN SELECT value FROM jsonb_array_elements(p_plans) LOOP
  t:=plan->>'table';
  IF jsonb_array_length(plan->'rows')=0 THEN CONTINUE; END IF;
  SELECT string_agg(format('%I',a.attname),',' ORDER BY a.attnum) INTO cols FROM pg_attribute a WHERE a.attrelid=format('public.%I',t)::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated='';
  EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I,$1)',t,cols,cols,t) USING plan->'rows';
 END LOOP;
 PERFORM public.sync_shop_sequences();
 RETURN total;
END;
$$;
REVOKE ALL ON FUNCTION public.kd_restore_records(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kd_restore_records(jsonb) TO authenticated;
