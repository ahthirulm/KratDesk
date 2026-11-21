CREATE SEQUENCE public.repair_job_seq;
GRANT USAGE ON SEQUENCE public.repair_job_seq TO service_role;
CREATE TABLE public.repair_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_no text NOT NULL UNIQUE DEFAULT 'RJ'||lpad(nextval('public.repair_job_seq')::text,6,'0'),
 branch_id text NOT NULL REFERENCES public.branches(id),
 customer_name text NOT NULL,
 customer_phone text NOT NULL DEFAULT '',
 item text NOT NULL,
 weight numeric CHECK (weight IS NULL OR (weight>0 AND weight<100000)),
 issue text NOT NULL DEFAULT '',
 charge numeric NOT NULL DEFAULT 0 CHECK (charge>=0),
 collected numeric NOT NULL DEFAULT 0 CHECK (collected>=0),
 repairer_id uuid REFERENCES public.expense_staff(id),
 repairer_name text NOT NULL DEFAULT '',
 repair_cost numeric NOT NULL DEFAULT 0 CHECK (repair_cost>=0),
 cost_paid numeric NOT NULL DEFAULT 0 CHECK (cost_paid>=0),
 est_delivery date NOT NULL,
 status text NOT NULL DEFAULT 'Received' CHECK (status IN ('Received','At repairer','Ready','Delivered','Cancelled')),
 received_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Colombo')::date,
 delivered_date date,
 note text NOT NULL DEFAULT '',
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX repair_jobs_branch_idx ON public.repair_jobs(branch_id,status,est_delivery);
GRANT SELECT ON public.repair_jobs TO authenticated;
GRANT ALL ON public.repair_jobs TO service_role;
ALTER TABLE public.repair_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY repair_jobs_read ON public.repair_jobs FOR SELECT TO authenticated USING (public.staff_can('Create bills',branch_id));

CREATE TABLE public.repair_job_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_id uuid NOT NULL REFERENCES public.repair_jobs(id),
 branch_id text NOT NULL REFERENCES public.branches(id),
 kind text NOT NULL,
 amount numeric NOT NULL DEFAULT 0,
 date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Colombo')::date,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.repair_job_events TO authenticated;
GRANT ALL ON public.repair_job_events TO service_role;
ALTER TABLE public.repair_job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY repair_job_events_read ON public.repair_job_events FOR SELECT TO authenticated USING (public.staff_can('Create bills',branch_id));

CREATE OR REPLACE FUNCTION public.repair_job_action(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE act text:=p->>'action'; j public.repair_jobs; b text; amt numeric:=0; nid uuid; rname text:=''; rid uuid; who text; d date:=(now() AT TIME ZONE 'Asia/Colombo')::date;
 FUNCTION_DUMMY int;
BEGIN
 BEGIN amt:=coalesce(nullif(p->>'amount','')::numeric,0); EXCEPTION WHEN others THEN RAISE EXCEPTION 'Enter a valid amount';END;
 IF amt<0 OR amt>1000000000000 OR amt<>round(amt,2) THEN RAISE EXCEPTION 'Enter a valid amount';END IF;
 who:=coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff');
 IF act='Create' THEN
  b:=p->>'branch_id';
  IF NOT public.staff_can('Create bills',b) THEN RAISE EXCEPTION 'You cannot manage repair jobs in this branch';END IF;
  IF length(trim(coalesce(p->>'customer_name','')))=0 OR length(p->>'customer_name')>120 THEN RAISE EXCEPTION 'Enter the customer name';END IF;
  IF length(trim(coalesce(p->>'item','')))=0 OR length(p->>'item')>200 THEN RAISE EXCEPTION 'Describe the item';END IF;
  IF nullif(p->>'est_delivery','') IS NULL THEN RAISE EXCEPTION 'Choose an estimated delivery date';END IF;
  IF coalesce((p->>'charge')::numeric,0)<0 THEN RAISE EXCEPTION 'Enter a valid charge';END IF;
  IF amt>coalesce((p->>'charge')::numeric,0) THEN RAISE EXCEPTION 'Advance cannot be more than the charge';END IF;
  INSERT INTO public.repair_jobs(branch_id,customer_name,customer_phone,item,weight,issue,charge,collected,est_delivery,note,created_by)
  VALUES(b,trim(p->>'customer_name'),left(trim(coalesce(p->>'customer_phone','')),30),trim(p->>'item'),nullif(p->>'weight','')::numeric,left(trim(coalesce(p->>'issue','')),300),round(coalesce((p->>'charge')::numeric,0),2),amt,(p->>'est_delivery')::date,left(trim(coalesce(p->>'note','')),300),auth.uid()) RETURNING * INTO j;
  IF amt>0 THEN PERFORM public.branch_cash_change(b,amt);INSERT INTO public.repair_job_events(job_id,branch_id,kind,amount,created_by) VALUES(j.id,b,'Customer payment',amt,auth.uid());END IF;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),who,b,'Repair jobs','Created','Repair job '||j.job_no||' for '||j.customer_name||' — '||j.item,j.id::text);
  RETURN j.id;
 END IF;
 SELECT * INTO j FROM public.repair_jobs WHERE id=(p->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Repair job not found';END IF;
 b:=j.branch_id;
 IF NOT public.staff_can('Create bills',b) THEN RAISE EXCEPTION 'You cannot manage repair jobs in this branch';END IF;
 IF j.status IN ('Delivered','Cancelled') THEN RAISE EXCEPTION 'This job is closed';END IF;
 IF act='Update' THEN
  rid:=nullif(p->>'repairer_id','')::uuid;
  IF rid IS NOT NULL THEN SELECT name INTO rname FROM public.expense_staff WHERE id=rid AND branch_id=b; IF rname IS NULL THEN RAISE EXCEPTION 'Choose a repairer from this branch';END IF;END IF;
  IF coalesce(p->>'status','') NOT IN ('Received','At repairer','Ready') THEN RAISE EXCEPTION 'Choose a valid status';END IF;
  IF (p->>'charge')::numeric<j.collected THEN RAISE EXCEPTION 'Charge cannot be less than what the customer already paid';END IF;
  IF (p->>'repair_cost')::numeric<j.cost_paid THEN RAISE EXCEPTION 'Repair cost cannot be less than what was already paid to the repairer';END IF;
  IF length(trim(coalesce(p->>'item','')))=0 THEN RAISE EXCEPTION 'Describe the item';END IF;
  UPDATE public.repair_jobs SET customer_name=trim(p->>'customer_name'),customer_phone=left(trim(coalesce(p->>'customer_phone','')),30),item=trim(p->>'item'),weight=nullif(p->>'weight','')::numeric,issue=left(trim(coalesce(p->>'issue','')),300),charge=round((p->>'charge')::numeric,2),repair_cost=round((p->>'repair_cost')::numeric,2),repairer_id=rid,repairer_name=coalesce(rname,''),est_delivery=(p->>'est_delivery')::date,status=p->>'status',note=left(trim(coalesce(p->>'note','')),300) WHERE id=j.id;
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
END $$;
REVOKE ALL ON FUNCTION public.repair_job_action(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.repair_job_action(jsonb) TO authenticated;