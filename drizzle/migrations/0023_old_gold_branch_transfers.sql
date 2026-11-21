CREATE TABLE public.old_gold_movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),from_branch text NOT NULL REFERENCES public.branches(id),to_branch text NOT NULL REFERENCES public.branches(id),purity integer NOT NULL CHECK(purity BETWEEN 1 AND 24),weight numeric NOT NULL CHECK(weight>0),cost_lkr numeric NOT NULL CHECK(cost_lkr>=0),note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL,CHECK(from_branch<>to_branch));
GRANT SELECT ON public.old_gold_movements TO authenticated;GRANT ALL ON public.old_gold_movements TO service_role;
ALTER TABLE public.old_gold_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY gold_movements_read ON public.old_gold_movements FOR SELECT TO authenticated USING((public.staff_can('View costs and profit',from_branch) AND (public.staff_can('Manage stock',from_branch) OR public.staff_can('View reports',from_branch))) OR (public.staff_can('View costs and profit',to_branch) AND (public.staff_can('Manage stock',to_branch) OR public.staff_can('View reports',to_branch))));
CREATE OR REPLACE FUNCTION public.transfer_old_gold(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source text:=p->>'from_branch';destination text:=p->>'to_branch';q integer:=(p->>'purity')::integer;w numeric:=(p->>'weight')::numeric;c numeric;holding public.old_gold_accounts;mid uuid;bid text;
BEGIN
IF NOT(public.staff_can('Transfer stock',source) AND public.staff_can('Manage stock',source) AND public.staff_can('View costs and profit',source)) THEN RAISE EXCEPTION 'Old-gold transfer permission required';END IF;
IF destination IS NULL OR source=destination OR NOT EXISTS(SELECT 1 FROM public.branches WHERE id=destination AND active) THEN RAISE EXCEPTION 'Choose another active branch';END IF;
IF q IS NULL OR q<1 OR q>24 OR w IS NULL OR w<=0 OR w>1000000000 OR w::text IN('NaN','Infinity','-Infinity') OR w<>round(w,3) THEN RAISE EXCEPTION 'Enter valid purity and positive weight with at most 3 decimals';END IF;
FOR bid IN SELECT x FROM unnest(ARRAY[source,destination]) x ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended('old-gold-'||bid||'-'||q,0));END LOOP;
SELECT * INTO holding FROM public.old_gold_accounts WHERE branch_id=source AND purity=q FOR UPDATE;
IF NOT FOUND OR holding.weight<w THEN RAISE EXCEPTION 'Transfer exceeds available old-gold weight for this purity';END IF;
c:=CASE WHEN w=holding.weight THEN holding.cost_lkr ELSE round(holding.cost_lkr*w/holding.weight,2) END;
INSERT INTO public.old_gold_accounts(branch_id,purity) VALUES(destination,q) ON CONFLICT DO NOTHING;
UPDATE public.old_gold_accounts SET weight=weight-w,cost_lkr=cost_lkr-c WHERE branch_id=source AND purity=q;
UPDATE public.old_gold_accounts SET weight=weight+w,cost_lkr=cost_lkr+c WHERE branch_id=destination AND purity=q;
INSERT INTO public.old_gold_movements(from_branch,to_branch,purity,weight,cost_lkr,note,created_by) VALUES(source,destination,q,w,c,coalesce(p->>'note',''),auth.uid()) RETURNING id INTO mid;RETURN mid;
END $$;
REVOKE ALL ON FUNCTION public.transfer_old_gold(jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.transfer_old_gold(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.audit_old_gold_transfer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(NEW.created_by,coalesce((SELECT display_name FROM public.profiles WHERE id=NEW.created_by),'Staff'),NEW.from_branch,'Old gold','Transferred','Transferred '||NEW.weight||'g of '||NEW.purity||'K old gold from '||(SELECT name FROM public.branches WHERE id=NEW.from_branch)||' to '||(SELECT name FROM public.branches WHERE id=NEW.to_branch),NEW.id::text);RETURN NEW;END $$;
CREATE TRIGGER audit_old_gold_transfer AFTER INSERT ON public.old_gold_movements FOR EACH ROW EXECUTE FUNCTION public.audit_old_gold_transfer();