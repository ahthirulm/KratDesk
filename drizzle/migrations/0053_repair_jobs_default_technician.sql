CREATE OR REPLACE FUNCTION public.repair_job_action(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cid uuid:=nullif(p->>'customer_id','')::uuid; jt text:=coalesce(nullif(p->>'job_type',''),'Repair'); cn text; cp text; act text:=p->>'action'; j public.repair_jobs; b text; amt numeric:=0; rname text:=''; who text; d date:=(now() AT TIME ZONE 'Asia/Colombo')::date; pp text:=nullif(p->>'photo_path','');
BEGIN
 BEGIN amt:=coalesce(nullif(p->>'amount','')::numeric,0); EXCEPTION WHEN others THEN RAISE EXCEPTION 'Enter a valid amount';END;
 IF amt<0 OR amt>1000000000000 OR amt<>round(amt,2) THEN RAISE EXCEPTION 'Enter a valid amount';END IF;
 IF pp IS NOT NULL AND NOT (pp ~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]{1,200}$')) THEN RAISE EXCEPTION 'Photo is not valid';END IF;
 who:=coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff');
 IF act='Create' THEN
  b:=p->>'branch_id';
  IF NOT public.staff_can('Create bills',b) THEN RAISE EXCEPTION 'You cannot manage repair jobs in this branch';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.job_types WHERE name=jt) THEN RAISE EXCEPTION 'Choose a job type';END IF;
  IF cid IS NOT NULL THEN SELECT name,phone INTO cn,cp FROM public.customers WHERE id=cid; IF cn IS NULL THEN RAISE EXCEPTION 'Customer not found';END IF;
  ELSE cn:=trim(coalesce(p->>'customer_name',''));cp:=left(trim(coalesce(p->>'customer_phone','')),30);END IF;
  IF length(cn)=0 OR length(cn)>120 THEN RAISE EXCEPTION 'Enter the customer name';END IF;
  IF length(trim(coalesce(p->>'item','')))=0 OR length(p->>'item')>200 THEN RAISE EXCEPTION 'Describe the item';END IF;
  IF nullif(p->>'est_delivery','') IS NULL THEN RAISE EXCEPTION 'Choose an estimated delivery date';END IF;
  IF coalesce((p->>'charge')::numeric,0)<0 THEN RAISE EXCEPTION 'Enter a valid charge';END IF;
  IF amt>coalesce((p->>'charge')::numeric,0) THEN RAISE EXCEPTION 'Advance cannot be more than the charge';END IF;
  INSERT INTO public.repair_jobs(job_type,customer_id,branch_id,customer_name,customer_phone,item,weight,issue,charge,collected,est_delivery,note,created_by,photo_path,repairer_name)
  VALUES(jt,cid,b,cn,cp,trim(p->>'item'),nullif(p->>'weight','')::numeric,left(trim(coalesce(p->>'issue','')),300),round(coalesce((p->>'charge')::numeric,0),2),amt,(p->>'est_delivery')::date,left(trim(coalesce(p->>'note','')),300),auth.uid(),pp,'Technician') RETURNING * INTO j;
  IF amt>0 THEN PERFORM public.branch_cash_change(b,amt);INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Customer payment',amt,auth.uid());END IF;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Created',j.job_type||' '||j.job_no||' for '||j.customer_name||' — '||j.item,j.id::text);
  RETURN j.id;
 END IF;
 SELECT * INTO j FROM public.repair_jobs WHERE id=(p->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Repair job not found';END IF;
 b:=j.branch_id;
 IF NOT public.staff_can('Create bills',b) THEN RAISE EXCEPTION 'You cannot manage repair jobs in this branch';END IF;
 IF act='Late repairer payment' THEN
  IF j.status<>'Delivered' THEN RAISE EXCEPTION 'Use Pay repairer for open jobs';END IF;
  IF amt<=0 THEN RAISE EXCEPTION 'Enter the amount paid';END IF;
  rname:=coalesce(nullif(j.repairer_name,''),'Technician');
  PERFORM public.branch_cash_change(b,-amt);
  UPDATE public.repair_jobs SET repairer_name=rname,repair_cost=repair_cost+amt,cost_paid=cost_paid+amt WHERE id=j.id;
  INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Pay repairer',amt,auth.uid());
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Repairer paid','Paid '||to_char(amt,'FM999,999,999,990.00')||' to '||rname||' for '||j.job_no||' after delivery',j.id::text);
  RETURN j.id;
 END IF;
 IF j.status IN ('Delivered','Cancelled') THEN RAISE EXCEPTION 'This job is closed';END IF;
 IF act='Update' THEN
  IF coalesce(p->>'status','') NOT IN ('Received','At repairer','Ready') THEN RAISE EXCEPTION 'Choose a valid status';END IF;
  IF (p->>'charge')::numeric<j.collected THEN RAISE EXCEPTION 'Charge cannot be less than what the customer already paid';END IF;
  IF (p->>'repair_cost')::numeric<j.cost_paid THEN RAISE EXCEPTION 'Repair cost cannot be less than what was already paid to the technician';END IF;
  IF length(trim(coalesce(p->>'item','')))=0 THEN RAISE EXCEPTION 'Describe the item';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.job_types WHERE name=jt) THEN RAISE EXCEPTION 'Choose a job type';END IF;
  IF cid IS NOT NULL THEN SELECT name,phone INTO cn,cp FROM public.customers WHERE id=cid; IF cn IS NULL THEN RAISE EXCEPTION 'Customer not found';END IF;
  ELSE cn:=trim(coalesce(p->>'customer_name',''));cp:=left(trim(coalesce(p->>'customer_phone','')),30);END IF;
  IF length(cn)=0 THEN RAISE EXCEPTION 'Enter the customer name';END IF;
  UPDATE public.repair_jobs SET job_type=jt,customer_id=cid,customer_name=cn,customer_phone=cp,item=trim(p->>'item'),weight=nullif(p->>'weight','')::numeric,issue=left(trim(coalesce(p->>'issue','')),300),charge=round((p->>'charge')::numeric,2),repair_cost=round((p->>'repair_cost')::numeric,2),repairer_name=coalesce(nullif(j.repairer_name,''),'Technician'),est_delivery=(p->>'est_delivery')::date,status=p->>'status',note=left(trim(coalesce(p->>'note','')),300),photo_path=CASE WHEN p ? 'photo_path' THEN pp ELSE j.photo_path END WHERE id=j.id;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Updated','Repair job '||j.job_no||' → '||(p->>'status'),j.id::text);
 ELSIF act='Customer payment' THEN
  IF amt<=0 OR j.collected+amt>j.charge THEN RAISE EXCEPTION 'Payment cannot be more than the balance due';END IF;
  UPDATE public.repair_jobs SET collected=collected+amt WHERE id=j.id;PERFORM public.branch_cash_change(b,amt);
  INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,act,amt,auth.uid());
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Payment','Received '||to_char(amt,'FM999,999,999,990.00')||' for '||j.job_no,j.id::text);
 ELSIF act='Pay repairer' THEN
  IF amt<=0 OR j.cost_paid+amt>j.repair_cost THEN RAISE EXCEPTION 'Payment cannot be more than the repair cost due';END IF;
  rname:=coalesce(nullif(j.repairer_name,''),'Technician');
  PERFORM public.branch_cash_change(b,-amt);UPDATE public.repair_jobs SET cost_paid=cost_paid+amt,repairer_name=rname WHERE id=j.id;
  INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,act,amt,auth.uid());
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Repairer paid','Paid '||to_char(amt,'FM999,999,999,990.00')||' to '||rname||' for '||j.job_no,j.id::text);
 ELSIF act='Deliver' THEN
  IF j.collected+amt<>j.charge THEN RAISE EXCEPTION 'Collect the full balance before delivery';END IF;
  IF j.cost_paid<>j.repair_cost THEN RAISE EXCEPTION 'Pay the technician in full before delivery';END IF;
  IF amt>0 THEN PERFORM public.branch_cash_change(b,amt);INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Customer payment',amt,auth.uid());END IF;
  UPDATE public.repair_jobs SET collected=collected+amt,status='Delivered',delivered_date=d WHERE id=j.id;
  INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Delivered',0,auth.uid());
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Delivered','Delivered '||j.job_no||' to '||j.customer_name,j.id::text);
 ELSIF act='Cancel' THEN
  IF j.cost_paid>0 THEN RAISE EXCEPTION 'The technician was already paid; deliver the job instead of cancelling';END IF;
  IF j.collected>0 THEN PERFORM public.branch_cash_change(b,-j.collected);INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Refund',j.collected,auth.uid());END IF;
  UPDATE public.repair_jobs SET status='Cancelled',delivered_date=d WHERE id=j.id;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Cancelled','Cancelled '||j.job_no||CASE WHEN j.collected>0 THEN '; refunded '||to_char(j.collected,'FM999,999,999,990.00') ELSE '' END,j.id::text);
 ELSE RAISE EXCEPTION 'Unknown action';
 END IF;
 RETURN j.id;
END $function$;

UPDATE public.repair_jobs SET repairer_name='Technician' WHERE repairer_name IS NULL OR repairer_name='';