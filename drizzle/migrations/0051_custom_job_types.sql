CREATE TABLE public.job_types(name text PRIMARY KEY CHECK (length(trim(name)) BETWEEN 1 AND 60), sort integer NOT NULL DEFAULT 0);
GRANT SELECT ON public.job_types TO authenticated;
GRANT ALL ON public.job_types TO service_role;
ALTER TABLE public.job_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read job types" ON public.job_types FOR SELECT TO authenticated USING (true);
INSERT INTO public.job_types(name,sort) VALUES('Repair',1),('Custom order',2);
ALTER TABLE public.repair_jobs DROP CONSTRAINT IF EXISTS repair_jobs_job_type_check;

CREATE OR REPLACE FUNCTION public.manage_job_type(old_name text, new_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o text:=nullif(trim(coalesce(old_name,'')),''); n text:=nullif(trim(coalesce(new_name,'')),''); who text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only an administrator can manage job types';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('job_types'));
 who:=coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff');
 IF n IS NOT NULL AND length(n)>60 THEN RAISE EXCEPTION 'Name is too long';END IF;
 IF o IS NULL THEN
  IF n IS NULL THEN RAISE EXCEPTION 'Enter a job type name';END IF;
  IF EXISTS(SELECT 1 FROM public.job_types WHERE lower(name)=lower(n)) THEN RAISE EXCEPTION 'This job type already exists';END IF;
  INSERT INTO public.job_types(name,sort) VALUES(n,coalesce((SELECT max(sort) FROM public.job_types),0)+1);
  INSERT INTO public.audit_events(actor_id,actor_name,category,action,description) VALUES(auth.uid(),who,'Repair jobs','Job type added','Added job type '||n);
 ELSIF n IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.repair_jobs WHERE job_type=o) THEN RAISE EXCEPTION 'This job type is used on jobs and cannot be removed; rename it instead';END IF;
  IF (SELECT count(*) FROM public.job_types)<=1 THEN RAISE EXCEPTION 'Keep at least one job type';END IF;
  DELETE FROM public.job_types WHERE name=o;
  INSERT INTO public.audit_events(actor_id,actor_name,category,action,description) VALUES(auth.uid(),who,'Repair jobs','Job type removed','Removed job type '||o);
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.job_types WHERE name=o) THEN RAISE EXCEPTION 'Job type not found';END IF;
  IF lower(o)<>lower(n) AND EXISTS(SELECT 1 FROM public.job_types WHERE lower(name)=lower(n)) THEN RAISE EXCEPTION 'This job type already exists';END IF;
  UPDATE public.job_types SET name=n WHERE name=o;
  UPDATE public.repair_jobs SET job_type=n WHERE job_type=o;
  INSERT INTO public.audit_events(actor_id,actor_name,category,action,description) VALUES(auth.uid(),who,'Repair jobs','Job type renamed','Renamed job type '||o||' to '||n);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.manage_job_type(text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.manage_job_type(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_job_action(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cid uuid:=nullif(p->>'customer_id','')::uuid; jt text:=coalesce(nullif(p->>'job_type',''),'Repair'); cn text; cp text; act text:=p->>'action'; j public.repair_jobs; b text; amt numeric:=0; nid uuid; rname text:=''; rid uuid; who text; d date:=(now() AT TIME ZONE 'Asia/Colombo')::date;
BEGIN
 BEGIN amt:=coalesce(nullif(p->>'amount','')::numeric,0); EXCEPTION WHEN others THEN RAISE EXCEPTION 'Enter a valid amount';END;
 IF amt<0 OR amt>1000000000000 OR amt<>round(amt,2) THEN RAISE EXCEPTION 'Enter a valid amount';END IF;
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
  INSERT INTO public.repair_jobs(job_type,customer_id,branch_id,customer_name,customer_phone,item,weight,issue,charge,collected,est_delivery,note,created_by)
  VALUES(jt,cid,b,cn,cp,trim(p->>'item'),nullif(p->>'weight','')::numeric,left(trim(coalesce(p->>'issue','')),300),round(coalesce((p->>'charge')::numeric,0),2),amt,(p->>'est_delivery')::date,left(trim(coalesce(p->>'note','')),300),auth.uid()) RETURNING * INTO j;
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
  rid:=coalesce(nullif(p->>'repairer_id','')::uuid,j.repairer_id);
  IF rid IS NULL THEN RAISE EXCEPTION 'Choose the repairer';END IF;
  SELECT name INTO rname FROM public.expense_staff WHERE id=rid AND branch_id=b; IF rname IS NULL THEN RAISE EXCEPTION 'Choose a repairer from this branch';END IF;
  IF amt<=0 THEN RAISE EXCEPTION 'Enter the amount paid';END IF;
  PERFORM public.branch_cash_change(b,-amt);
  UPDATE public.repair_jobs SET repairer_id=rid,repairer_name=rname,repair_cost=repair_cost+amt,cost_paid=cost_paid+amt WHERE id=j.id;
  INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Pay repairer',amt,auth.uid());
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Repairer paid','Paid '||to_char(amt,'FM999,999,999,990.00')||' to '||rname||' for '||j.job_no||' after delivery',j.id::text);
  RETURN j.id;
 END IF;
 IF j.status IN ('Delivered','Cancelled') THEN RAISE EXCEPTION 'This job is closed';END IF;
 IF act='Update' THEN
  rid:=nullif(p->>'repairer_id','')::uuid;
  IF rid IS NOT NULL THEN SELECT name INTO rname FROM public.expense_staff WHERE id=rid AND branch_id=b; IF rname IS NULL THEN RAISE EXCEPTION 'Choose a repairer from this branch';END IF;END IF;
  IF coalesce(p->>'status','') NOT IN ('Received','At repairer','Ready') THEN RAISE EXCEPTION 'Choose a valid status';END IF;
  IF (p->>'charge')::numeric<j.collected THEN RAISE EXCEPTION 'Charge cannot be less than what the customer already paid';END IF;
  IF (p->>'repair_cost')::numeric<j.cost_paid THEN RAISE EXCEPTION 'Repair cost cannot be less than what was already paid to the repairer';END IF;
  IF length(trim(coalesce(p->>'item','')))=0 THEN RAISE EXCEPTION 'Describe the item';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.job_types WHERE name=jt) THEN RAISE EXCEPTION 'Choose a job type';END IF;
  IF cid IS NOT NULL THEN SELECT name,phone INTO cn,cp FROM public.customers WHERE id=cid; IF cn IS NULL THEN RAISE EXCEPTION 'Customer not found';END IF;
  ELSE cn:=trim(coalesce(p->>'customer_name',''));cp:=left(trim(coalesce(p->>'customer_phone','')),30);END IF;
  IF length(cn)=0 THEN RAISE EXCEPTION 'Enter the customer name';END IF;
  UPDATE public.repair_jobs SET job_type=jt,customer_id=cid,customer_name=cn,customer_phone=cp,item=trim(p->>'item'),weight=nullif(p->>'weight','')::numeric,issue=left(trim(coalesce(p->>'issue','')),300),charge=round((p->>'charge')::numeric,2),repair_cost=round((p->>'repair_cost')::numeric,2),repairer_id=rid,repairer_name=coalesce(rname,''),est_delivery=(p->>'est_delivery')::date,status=p->>'status',note=left(trim(coalesce(p->>'note','')),300) WHERE id=j.id;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Updated','Repair job '||j.job_no||' → '||(p->>'status'),j.id::text);
 ELSIF act='Customer payment' THEN
  IF amt<=0 OR j.collected+amt>j.charge THEN RAISE EXCEPTION 'Payment cannot be more than the balance due';END IF;
  UPDATE public.repair_jobs SET collected=collected+amt WHERE id=j.id;PERFORM public.branch_cash_change(b,amt);
  INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,act,amt,auth.uid());
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Payment','Received '||to_char(amt,'FM999,999,999,990.00')||' for '||j.job_no,j.id::text);
 ELSIF act='Pay repairer' THEN
  IF j.repairer_id IS NULL THEN RAISE EXCEPTION 'Choose the repairer first';END IF;
  IF amt<=0 OR j.cost_paid+amt>j.repair_cost THEN RAISE EXCEPTION 'Payment cannot be more than the repair cost due';END IF;
  PERFORM public.branch_cash_change(b,-amt);UPDATE public.repair_jobs SET cost_paid=cost_paid+amt WHERE id=j.id;
  INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,act,amt,auth.uid());
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Repairer paid','Paid '||to_char(amt,'FM999,999,999,990.00')||' to '||j.repairer_name||' for '||j.job_no,j.id::text);
 ELSIF act='Deliver' THEN
  IF j.collected+amt<>j.charge THEN RAISE EXCEPTION 'Collect the full balance before delivery';END IF;
  IF j.cost_paid<>j.repair_cost THEN RAISE EXCEPTION 'Pay the repairer in full before delivery';END IF;
  IF amt>0 THEN PERFORM public.branch_cash_change(b,amt);INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Customer payment',amt,auth.uid());END IF;
  UPDATE public.repair_jobs SET collected=collected+amt,status='Delivered',delivered_date=d WHERE id=j.id;
  INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Delivered',0,auth.uid());
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Delivered','Delivered '||j.job_no||' to '||j.customer_name,j.id::text);
 ELSIF act='Cancel' THEN
  IF j.cost_paid>0 THEN RAISE EXCEPTION 'The repairer was already paid; deliver the job instead of cancelling';END IF;
  IF j.collected>0 THEN PERFORM public.branch_cash_change(b,-j.collected);INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Refund',j.collected,auth.uid());END IF;
  UPDATE public.repair_jobs SET status='Cancelled',delivered_date=d WHERE id=j.id;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Cancelled','Cancelled '||j.job_no||CASE WHEN j.collected>0 THEN '; refunded '||to_char(j.collected,'FM999,999,999,990.00') ELSE '' END,j.id::text);
 ELSE RAISE EXCEPTION 'Unknown action';
 END IF;
 RETURN j.id;
END $function$;