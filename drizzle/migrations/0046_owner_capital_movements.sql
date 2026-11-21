CREATE TABLE public.capital_movements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 branch_id text NOT NULL REFERENCES public.branches(id),
 kind text NOT NULL CHECK (kind IN ('Owner cash in','Owner cash out','Bank deposit','Bank withdrawal')),
 amount numeric NOT NULL CHECK (amount>0 AND amount<=1000000000000 AND amount=round(amount,2)),
 note text NOT NULL DEFAULT '' CHECK (length(note)<=300),
 date date NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX capital_movements_branch_idx ON public.capital_movements(branch_id,date);
GRANT SELECT ON public.capital_movements TO authenticated;
GRANT ALL ON public.capital_movements TO service_role;
ALTER TABLE public.capital_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY capital_movements_admin_read ON public.capital_movements FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.record_capital_movement(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id'; k text:=p->>'kind'; a numeric; n text:=trim(coalesce(p->>'note','')); d date; bank numeric; nid uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only the owner can record cash in or cash out';END IF;
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
 VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Owner'),b,'Owner cash','Recorded',k||' '||to_char(a,'FM999,999,999,999,990.00')||CASE WHEN n<>'' THEN ' — '||n ELSE '' END,nid::text);
 RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_capital_movement(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_capital_movement(jsonb) TO authenticated;