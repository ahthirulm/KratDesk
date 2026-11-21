ALTER TABLE public.fx_entries ADD CONSTRAINT fx_entries_safe_values CHECK(amount<=1000000000000 AND rate<=1000000000000 AND amount::text NOT IN('NaN','Infinity','-Infinity') AND rate::text NOT IN('NaN','Infinity','-Infinity') AND lkr_total::text NOT IN('NaN','Infinity','-Infinity') AND cost_lkr::text NOT IN('NaN','Infinity','-Infinity') AND profit_lkr::text NOT IN('NaN','Infinity','-Infinity')) NOT VALID;
ALTER TABLE public.fx_accounts ADD CONSTRAINT fx_accounts_safe_values CHECK(balance::text NOT IN('NaN','Infinity','-Infinity') AND cost_lkr::text NOT IN('NaN','Infinity','-Infinity')) NOT VALID;
ALTER TABLE public.old_gold_entries ADD CONSTRAINT old_gold_entries_safe_values CHECK(weight<=1000000000 AND unit_price<=1000000000000 AND weight::text NOT IN('NaN','Infinity','-Infinity') AND unit_price::text NOT IN('NaN','Infinity','-Infinity') AND total_lkr::text NOT IN('NaN','Infinity','-Infinity') AND cost_lkr::text NOT IN('NaN','Infinity','-Infinity') AND profit_lkr::text NOT IN('NaN','Infinity','-Infinity')) NOT VALID;
ALTER TABLE public.old_gold_accounts ADD CONSTRAINT old_gold_accounts_safe_values CHECK(weight::text NOT IN('NaN','Infinity','-Infinity') AND cost_lkr::text NOT IN('NaN','Infinity','-Infinity')) NOT VALID;

CREATE OR REPLACE FUNCTION public.capture_sale_split() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p jsonb;s jsonb;x jsonb;tot numeric:=0;a numeric;
BEGIN
 IF NEW.payment_method<>'Mixed' THEN NEW.payment_split:=NULL;RETURN NEW;END IF;
 p:=nullif(current_setting('app.cheque_payment',true),'')::jsonb;s:=p->'split';
 IF s IS NULL THEN RETURN NEW;END IF;
 IF jsonb_typeof(s)<>'array' OR jsonb_array_length(s)<>2 OR s->0->>'method'=s->1->>'method' THEN RAISE EXCEPTION 'Split payment needs two different methods';END IF;
 FOR x IN SELECT * FROM jsonb_array_elements(s) LOOP
  a:=(x->>'amount')::numeric;
  IF x->>'method' NOT IN('Cash','Card','Bank Transfer','Cheque') OR a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) THEN RAISE EXCEPTION 'Invalid split payment part';END IF;
  tot:=tot+round(a,2);
 END LOOP;
 IF tot<>NEW.paid_now THEN RAISE EXCEPTION 'Split amounts must add up to the amount paid';END IF;
 NEW.payment_split:=jsonb_build_array(jsonb_build_object('method',s->0->>'method','amount',round((s->0->>'amount')::numeric,2)),jsonb_build_object('method',s->1->>'method','amount',round((s->1->>'amount')::numeric,2)));RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.record_fx_entry(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id';c text:=upper(trim(p->>'currency'));k text:=p->>'kind';a numeric:=(p->>'amount')::numeric;r numeric:=(p->>'rate')::numeric;t numeric;cost numeric:=0;profit numeric:=0;cash public.fx_accounts;holding public.fx_accounts;eid uuid;existing uuid;
BEGIN
 IF NOT public.staff_can('Manage currency exchange',b) THEN RAISE EXCEPTION 'Currency exchange permission required';END IF;
 existing:=public.operation_begin(p,'currency-entry');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.branches WHERE id=b AND active) THEN RAISE EXCEPTION 'Choose an active branch';END IF;
 IF k IS NULL OR k NOT IN('Buy','Sell','Funding','Withdrawal') OR a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) OR r IS NULL OR r<=0 OR r>1000000000000 OR r::text IN('NaN','Infinity','-Infinity') OR r<>round(r,6) THEN RAISE EXCEPTION 'Enter a positive amount (up to 2 decimals) and rate (up to 6 decimals)';END IF;
 IF length(coalesce(p->>'counterparty',''))>160 OR length(coalesce(p->>'reference',''))>120 OR length(coalesce(p->>'note',''))>1000 THEN RAISE EXCEPTION 'Customer, reference or note is too long';END IF;
 IF c='LKR' AND (k IN('Buy','Sell') OR r<>1) THEN RAISE EXCEPTION 'LKR is only for exchange funding or withdrawal at rate 1';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('fx-directory',0));
 IF c IS NULL OR (c<>'LKR' AND NOT EXISTS(SELECT 1 FROM public.fx_currencies WHERE code=c AND active)) THEN RAISE EXCEPTION 'Choose an active currency';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('fx-branch-'||b,0));
 INSERT INTO public.fx_accounts(branch_id,currency) VALUES(b,'LKR') ON CONFLICT DO NOTHING;INSERT INTO public.fx_accounts(branch_id,currency) VALUES(b,c) ON CONFLICT DO NOTHING;
 SELECT * INTO cash FROM public.fx_accounts WHERE branch_id=b AND currency='LKR' FOR UPDATE;SELECT * INTO holding FROM public.fx_accounts WHERE branch_id=b AND currency=c FOR UPDATE;
 t:=round(a*r,2);IF t<=0 THEN RAISE EXCEPTION 'Total must be at least 0.01';END IF;
 IF k='Funding' THEN UPDATE public.fx_accounts SET balance=balance+a,cost_lkr=cost_lkr+CASE WHEN c='LKR' THEN 0 ELSE t END WHERE branch_id=b AND currency=c;cost:=CASE WHEN c='LKR' THEN 0 ELSE t END;
 ELSIF k='Withdrawal' THEN IF holding.balance<a THEN RAISE EXCEPTION 'Insufficient exchange account balance';END IF;cost:=CASE WHEN c='LKR' THEN 0 WHEN a=holding.balance THEN holding.cost_lkr ELSE round(holding.cost_lkr*a/holding.balance,2) END;UPDATE public.fx_accounts SET balance=balance-a,cost_lkr=cost_lkr-cost WHERE branch_id=b AND currency=c;
 ELSIF k='Buy' THEN IF cash.balance<t THEN RAISE EXCEPTION 'Insufficient exchange funds; fund the account first';END IF;UPDATE public.fx_accounts SET balance=balance-t WHERE branch_id=b AND currency='LKR';UPDATE public.fx_accounts SET balance=balance+a,cost_lkr=cost_lkr+t WHERE branch_id=b AND currency=c;cost:=t;
 ELSE IF holding.balance<a THEN RAISE EXCEPTION 'Insufficient foreign currency balance';END IF;cost:=CASE WHEN a=holding.balance THEN holding.cost_lkr ELSE round(holding.cost_lkr*a/holding.balance,2) END;profit:=t-cost;UPDATE public.fx_accounts SET balance=balance-a,cost_lkr=cost_lkr-cost WHERE branch_id=b AND currency=c;UPDATE public.fx_accounts SET balance=balance+t WHERE branch_id=b AND currency='LKR';END IF;
 INSERT INTO public.fx_entries(branch_id,currency,kind,amount,rate,lkr_total,cost_lkr,profit_lkr,counterparty,reference,note,created_by) VALUES(b,c,k,a,r,t,cost,profit,trim(coalesce(p->>'counterparty','')),trim(coalesce(p->>'reference','')),trim(coalesce(p->>'note','')),auth.uid()) RETURNING id INTO eid;
 PERFORM public.operation_finish(p,'currency-entry',eid);RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION public.record_old_gold(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id';k text:=p->>'kind';q integer:=(p->>'purity')::integer;w numeric:=(p->>'weight')::numeric;price numeric:=(p->>'unit_price')::numeric;u text:=p->>'pricing_unit';m text:=p->>'method';t numeric;c numeric;profit numeric:=0;holding public.old_gold_accounts;eid uuid;existing uuid;
BEGIN
 IF NOT(public.staff_can('Manage stock',b) AND public.staff_can('View costs and profit',b)) THEN RAISE EXCEPTION 'Stock management and cost/profit permissions required';END IF;
 existing:=public.operation_begin(p,'old-gold-entry');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.branches WHERE id=b AND active) THEN RAISE EXCEPTION 'Choose an active branch';END IF;
 IF k IS NULL OR k NOT IN('Buy','Sell') OR q IS NULL OR q<1 OR q>24 OR w IS NULL OR w<=0 OR w>1000000000 OR w::text IN('NaN','Infinity','-Infinity') OR w<>round(w,3) OR price IS NULL OR price<=0 OR price>1000000000000 OR price::text IN('NaN','Infinity','-Infinity') OR price<>round(price,2) OR u IS NULL OR u NOT IN('Gram','Pound (8g)') OR m IS NULL OR m NOT IN('Cash','Bank Transfer','Card') THEN RAISE EXCEPTION 'Enter valid purity, weight (3 decimals), unit price (2 decimals) and payment method';END IF;
 IF length(coalesce(p->>'customer_name',''))>160 OR length(coalesce(p->>'customer_phone',''))>30 OR length(coalesce(p->>'reference',''))>120 OR length(coalesce(p->>'note',''))>1000 THEN RAISE EXCEPTION 'Customer, reference or note is too long';END IF;
 t:=round(w*price/CASE WHEN u='Pound (8g)' THEN 8 ELSE 1 END,2);IF t<=0 THEN RAISE EXCEPTION 'Total must be at least 0.01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('old-gold-'||b||'-'||q,0));INSERT INTO public.old_gold_accounts(branch_id,purity) VALUES(b,q) ON CONFLICT DO NOTHING;SELECT * INTO holding FROM public.old_gold_accounts WHERE branch_id=b AND purity=q FOR UPDATE;
 IF k='Buy' THEN c:=t;UPDATE public.old_gold_accounts SET weight=weight+w,cost_lkr=cost_lkr+t WHERE branch_id=b AND purity=q;
 ELSE IF holding.weight<w THEN RAISE EXCEPTION 'Sale exceeds available old-gold weight for this purity';END IF;c:=CASE WHEN w=holding.weight THEN holding.cost_lkr ELSE round(holding.cost_lkr*w/holding.weight,2) END;profit:=t-c;UPDATE public.old_gold_accounts SET weight=weight-w,cost_lkr=cost_lkr-c WHERE branch_id=b AND purity=q;END IF;
 INSERT INTO public.old_gold_entries(branch_id,purity,kind,weight,pricing_unit,unit_price,total_lkr,cost_lkr,profit_lkr,customer_name,customer_phone,method,reference,note,created_by) VALUES(b,q,k,w,u,price,t,c,profit,trim(coalesce(p->>'customer_name','')),trim(coalesce(p->>'customer_phone','')),m,trim(coalesce(p->>'reference','')),trim(coalesce(p->>'note','')),auth.uid()) RETURNING id INTO eid;
 PERFORM public.operation_finish(p,'old-gold-entry',eid);RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_old_gold(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source text:=p->>'from_branch';destination text:=p->>'to_branch';q integer:=(p->>'purity')::integer;w numeric:=(p->>'weight')::numeric;c numeric;holding public.old_gold_accounts;mid uuid;bid text;existing uuid;
BEGIN
 IF NOT(public.staff_can('Transfer stock',source) AND public.staff_can('Manage stock',source) AND public.staff_can('View costs and profit',source)) THEN RAISE EXCEPTION 'Old-gold transfer permission required';END IF;
 existing:=public.operation_begin(p,'old-gold-transfer');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF destination IS NULL OR source=destination OR NOT EXISTS(SELECT 1 FROM public.branches WHERE id=destination AND active) OR NOT EXISTS(SELECT 1 FROM public.branches WHERE id=source AND active) THEN RAISE EXCEPTION 'Choose another active branch';END IF;
 IF q IS NULL OR q<1 OR q>24 OR w IS NULL OR w<=0 OR w>1000000000 OR w::text IN('NaN','Infinity','-Infinity') OR w<>round(w,3) THEN RAISE EXCEPTION 'Enter valid purity and positive weight with at most 3 decimals';END IF;
 FOR bid IN SELECT x FROM unnest(ARRAY[source,destination]) x ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended('old-gold-'||bid||'-'||q,0));END LOOP;
 SELECT * INTO holding FROM public.old_gold_accounts WHERE branch_id=source AND purity=q FOR UPDATE;IF NOT FOUND OR holding.weight<w THEN RAISE EXCEPTION 'Transfer exceeds available old-gold weight for this purity';END IF;
 c:=CASE WHEN w=holding.weight THEN holding.cost_lkr ELSE round(holding.cost_lkr*w/holding.weight,2) END;
 INSERT INTO public.old_gold_accounts(branch_id,purity) VALUES(destination,q) ON CONFLICT DO NOTHING;UPDATE public.old_gold_accounts SET weight=weight-w,cost_lkr=cost_lkr-c WHERE branch_id=source AND purity=q;UPDATE public.old_gold_accounts SET weight=weight+w,cost_lkr=cost_lkr+c WHERE branch_id=destination AND purity=q;
 INSERT INTO public.old_gold_movements(from_branch,to_branch,purity,weight,cost_lkr,note,created_by) VALUES(source,destination,q,w,c,trim(coalesce(p->>'note','')),auth.uid()) RETURNING id INTO mid;
 PERFORM public.operation_finish(p,'old-gold-transfer',mid);RETURN mid;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_stock(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.items;dest text:=p->>'to_branch';mid uuid;existing uuid;
BEGIN
 SELECT * INTO i FROM public.items WHERE id=(p->>'item_id')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT public.staff_can('Transfer stock',i.branch_id) THEN RAISE EXCEPTION 'Transfer permission required';END IF;
 existing:=public.operation_begin(p,'stock-transfer');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF i.status<>'In Stock' THEN RAISE EXCEPTION 'Only in-stock pieces can be transferred';END IF;
 IF i.branch_id<>p->>'from_branch' THEN RAISE EXCEPTION 'Piece has already moved';END IF;
 IF dest=i.branch_id OR NOT EXISTS(SELECT 1 FROM public.branches WHERE id=dest AND active) THEN RAISE EXCEPTION 'Choose another active branch';END IF;
 INSERT INTO public.stock_movements(item_id,from_branch,to_branch,internal_tag,system_tag,note,performed_by) VALUES(i.id,i.branch_id,dest,i.tag_id,i.system_tag,trim(coalesce(p->>'note','')),auth.uid()) RETURNING id INTO mid;
 UPDATE public.items SET branch_id=dest WHERE id=i.id;PERFORM public.operation_finish(p,'stock-transfer',mid);RETURN mid;
END $$;

CREATE OR REPLACE FUNCTION public.add_reminder(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id';rid uuid;existing uuid;title text:=nullif(trim(p->>'title'),'');
BEGIN
 IF NOT (public.staff_can('Create bills',b) OR public.staff_can('Collect repayments',b)) THEN RAISE EXCEPTION 'Permission required';END IF;
 existing:=public.operation_begin(p,'reminder-add');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF title IS NULL OR length(title)>200 OR length(coalesce(p->>'note',''))>1000 OR nullif(p->>'remind_date','') IS NULL OR NOT EXISTS(SELECT 1 FROM public.branches WHERE id=b AND active) THEN RAISE EXCEPTION 'Enter a reminder title, valid date and active branch';END IF;
 INSERT INTO public.reminders(branch_id,title,note,remind_date,created_by) VALUES(b,title,trim(coalesce(p->>'note','')),(p->>'remind_date')::date,auth.uid()) RETURNING id INTO rid;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Reminders','Added','Added reminder "'||title||'" for '||(p->>'remind_date'),rid::text);
 PERFORM public.operation_finish(p,'reminder-add',rid);RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.update_reminder(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.reminders;title text:=nullif(trim(p->>'title'),'');
BEGIN
 SELECT * INTO r FROM public.reminders WHERE id=(p->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT (public.staff_can('Create bills',r.branch_id) OR public.staff_can('Collect repayments',r.branch_id)) THEN RAISE EXCEPTION 'Permission required';END IF;
 IF r.done_at IS NOT NULL THEN RAISE EXCEPTION 'Completed reminders cannot be edited';END IF;
 IF title IS NULL OR length(title)>200 OR length(coalesce(p->>'note',''))>1000 OR nullif(p->>'remind_date','') IS NULL THEN RAISE EXCEPTION 'Enter a reminder title and valid date';END IF;
 UPDATE public.reminders SET title=title,note=trim(coalesce(p->>'note','')),remind_date=(p->>'remind_date')::date WHERE id=r.id;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),r.branch_id,'Reminders','Updated','Edited reminder "'||title||'" for '||(p->>'remind_date'),r.id::text);
END $$;