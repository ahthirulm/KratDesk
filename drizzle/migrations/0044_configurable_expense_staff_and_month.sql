CREATE TABLE public.expense_staff(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 branch_id text NOT NULL REFERENCES public.branches(id),
 name text NOT NULL CHECK(length(trim(name))>0 AND length(trim(name))<=120),
 active boolean NOT NULL DEFAULT true,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expense_staff TO authenticated;
GRANT ALL ON public.expense_staff TO service_role;
ALTER TABLE public.expense_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_staff_read ON public.expense_staff FOR SELECT TO authenticated USING(public.staff_can('Manage expenses',branch_id));
CREATE UNIQUE INDEX expense_staff_unique_name ON public.expense_staff(branch_id,lower(trim(name)));

ALTER TABLE public.petty_cash_categories ADD COLUMN requires_staff boolean NOT NULL DEFAULT false;
ALTER TABLE public.petty_cash_categories ADD COLUMN requires_month boolean NOT NULL DEFAULT false;
ALTER TABLE public.petty_cash_entries ADD COLUMN staff_id uuid REFERENCES public.expense_staff(id);
ALTER TABLE public.petty_cash_entries ADD COLUMN staff_name text;
ALTER TABLE public.petty_cash_entries ADD COLUMN expense_month text;
ALTER TABLE public.petty_cash_entries ADD CONSTRAINT petty_expense_month_format CHECK(expense_month IS NULL OR expense_month~'^[0-9]{4}-(0[1-9]|1[0-2])$');

CREATE FUNCTION public.add_expense_staff(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=nullif(trim(p->>'branch_id'),'');n text:=nullif(trim(p->>'name'),'');sid uuid;existing uuid;
BEGIN
 IF b IS NULL OR NOT public.staff_can('Manage expenses',b) THEN RAISE EXCEPTION 'Expense management permission required';END IF;
 IF n IS NULL OR length(n)>120 THEN RAISE EXCEPTION 'Enter a valid staff name';END IF;
 existing:=public.operation_begin(p,'expense-staff-save');IF existing IS NOT NULL THEN RETURN existing;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('expense-staff-'||b,0));
 IF EXISTS(SELECT 1 FROM public.expense_staff WHERE branch_id=b AND lower(trim(name))=lower(n)) THEN RAISE EXCEPTION 'This staff member already exists';END IF;
 INSERT INTO public.expense_staff(branch_id,name,created_by) VALUES(b,n,auth.uid()) RETURNING id INTO sid;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Staff added','Added expense staff member '||n,sid::text);
 PERFORM public.operation_finish(p,'expense-staff-save',sid);RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.add_expense_staff(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_expense_staff(jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.manage_petty_cash_category(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id';cid uuid:=nullif(p->>'id','')::uuid;n text:=nullif(trim(p->>'name'),'');oldcat public.petty_cash_categories%ROWTYPE;reqstaff boolean;reqmonth boolean;
BEGIN
 IF NOT public.staff_can('Manage expenses',b) THEN RAISE EXCEPTION 'Expense management permission required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('petty-category-'||b,0));
 IF cid IS NOT NULL THEN SELECT * INTO oldcat FROM public.petty_cash_categories WHERE id=cid AND branch_id=b FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Category not found in this branch';END IF;END IF;
 IF p->>'action'='Remove' THEN
  IF cid IS NULL THEN RAISE EXCEPTION 'Choose a category';END IF;
  IF EXISTS(SELECT 1 FROM public.petty_cash_entries WHERE category_id=cid OR (branch_id=b AND kind='Expense' AND category=oldcat.name)) THEN RAISE EXCEPTION 'This category is used by expenses and cannot be removed';END IF;
  DELETE FROM public.petty_cash_categories WHERE id=cid;
 ELSE
  IF n IS NULL THEN RAISE EXCEPTION 'Enter a category name';END IF;
  IF EXISTS(SELECT 1 FROM public.petty_cash_categories WHERE branch_id=b AND lower(trim(name))=lower(n) AND id IS DISTINCT FROM cid) THEN RAISE EXCEPTION 'This category already exists';END IF;
  reqstaff:=CASE WHEN p?'requires_staff' THEN coalesce((p->>'requires_staff')::boolean,false) WHEN cid IS NOT NULL THEN oldcat.requires_staff ELSE lower(n) IN('salary','salaries') END;
  reqmonth:=CASE WHEN p?'requires_month' THEN coalesce((p->>'requires_month')::boolean,false) WHEN cid IS NOT NULL THEN oldcat.requires_month ELSE lower(n) IN('salary','salaries') END;
  IF cid IS NULL THEN INSERT INTO public.petty_cash_categories(branch_id,name,requires_staff,requires_month) VALUES(b,n,reqstaff,reqmonth) RETURNING id INTO cid;
  ELSE UPDATE public.petty_cash_categories SET name=n,requires_staff=reqstaff,requires_month=reqmonth WHERE id=cid;END IF;
 END IF;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expense categories',CASE WHEN p->>'action'='Remove' THEN 'Removed' WHEN cid IS NOT NULL AND oldcat.id IS NULL THEN 'Added' ELSE 'Updated' END,CASE WHEN p->>'action'='Remove' THEN 'Removed expense category '||oldcat.name WHEN oldcat.id IS NULL THEN 'Added expense category '||n ELSE 'Updated expense category '||oldcat.name||' to '||n END,cid::text);
 RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.record_petty_cash(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id';k text:=p->>'kind';a numeric:=(p->>'amount')::numeric;eid uuid;existing uuid;cat public.petty_cash_categories%ROWTYPE;sid uuid:=nullif(p->>'staff_id','')::uuid;sname text;emonth text:=nullif(trim(p->>'expense_month'),'');
BEGIN
 IF NOT public.staff_can('Manage expenses',b) THEN RAISE EXCEPTION 'Expense management permission required';END IF;
 existing:=public.operation_begin(p,'petty-cash');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF k<>'Expense' THEN RAISE EXCEPTION 'Top-ups are not available; record shop receipts in main cash instead';END IF;
 IF a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) OR nullif(trim(p->>'description'),'') IS NULL OR length(trim(p->>'description'))>500 THEN RAISE EXCEPTION 'Enter a valid amount and description';END IF;
 a:=round(a,2);PERFORM pg_advisory_xact_lock(hashtextextended('petty-cash-'||b,0));
 SELECT * INTO cat FROM public.petty_cash_categories WHERE branch_id=b AND name=trim(p->>'category') FOR KEY SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Choose an existing expense category';END IF;
 IF cat.requires_staff THEN IF sid IS NULL THEN RAISE EXCEPTION 'Choose a staff member';END IF;SELECT name INTO sname FROM public.expense_staff WHERE id=sid AND branch_id=b AND active;IF NOT FOUND THEN RAISE EXCEPTION 'Choose a staff member from this branch';END IF;ELSE sid:=NULL;sname:=NULL;END IF;
 IF cat.requires_month THEN IF emonth IS NULL OR emonth!~'^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Choose a valid expense month';END IF;ELSE emonth:=NULL;END IF;
 INSERT INTO public.petty_cash_entries(branch_id,kind,amount,category,category_id,description,reference,created_by,staff_id,staff_name,expense_month) VALUES(b,k,a,cat.name,cat.id,trim(p->>'description'),trim(coalesce(p->>'reference','')),auth.uid(),sid,sname,emonth) RETURNING id INTO eid;
 PERFORM public.branch_cash_change(b,-a);
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Spent','Spent '||to_char(a,'FM999,999,999,999,990.00')||' — '||trim(p->>'description')||coalesce(' · '||sname,'')||coalesce(' · '||emonth,''),eid::text);
 PERFORM public.operation_finish(p,'petty-cash',eid);RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION public.change_petty_expense(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=nullif(trim(p->>'branch_id'),'');eid uuid:=nullif(p->>'id','')::uuid;action text:=p->>'action';e public.petty_cash_entries%ROWTYPE;cat public.petty_cash_categories%ROWTYPE;a numeric;d date;existing uuid;sid uuid:=nullif(p->>'staff_id','')::uuid;sname text;emonth text:=nullif(trim(p->>'expense_month'),'');
BEGIN
 IF b IS NULL OR eid IS NULL OR action NOT IN('Save','Delete') THEN RAISE EXCEPTION 'Choose a valid expense action';END IF;
 IF NOT public.staff_can('Manage expenses',b) THEN RAISE EXCEPTION 'Expense management permission required';END IF;
 existing:=public.operation_begin(p,'petty-expense-change');IF existing IS NOT NULL THEN RETURN existing;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('petty-cash-'||b,0));
 SELECT * INTO e FROM public.petty_cash_entries WHERE id=eid AND branch_id=b FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found in this branch';END IF;IF e.kind<>'Expense' THEN RAISE EXCEPTION 'Historical top-ups cannot be edited or deleted';END IF;
 IF action='Delete' THEN
  PERFORM public.branch_cash_change(b,e.amount);DELETE FROM public.petty_cash_entries WHERE id=e.id;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Deleted','Deleted expense '||to_char(e.amount,'FM999,999,999,999,990.00')||' — '||e.description||'; returned to main cash',e.id::text);
 ELSE
  a:=(p->>'amount')::numeric;d:=coalesce(nullif(p->>'date','')::date,e.date);
  IF a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) OR nullif(trim(p->>'description'),'') IS NULL OR length(trim(p->>'description'))>500 OR length(trim(coalesce(p->>'reference','')))>120 THEN RAISE EXCEPTION 'Enter a valid amount, description and reference';END IF;
  IF d>(now() AT TIME ZONE 'Asia/Colombo')::date THEN RAISE EXCEPTION 'Expense date cannot be in the future';END IF;
  SELECT * INTO cat FROM public.petty_cash_categories WHERE branch_id=b AND name=trim(p->>'category') FOR KEY SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Choose an existing expense category';END IF;
  IF cat.requires_staff THEN IF sid IS NULL THEN RAISE EXCEPTION 'Choose a staff member';END IF;SELECT name INTO sname FROM public.expense_staff WHERE id=sid AND branch_id=b AND active;IF NOT FOUND THEN RAISE EXCEPTION 'Choose a staff member from this branch';END IF;ELSE sid:=NULL;sname:=NULL;END IF;
  IF cat.requires_month THEN IF emonth IS NULL OR emonth!~'^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Choose a valid expense month';END IF;ELSE emonth:=NULL;END IF;
  a:=round(a,2);PERFORM public.branch_cash_change(b,e.amount-a);
  UPDATE public.petty_cash_entries SET amount=a,category=cat.name,category_id=cat.id,description=trim(p->>'description'),reference=trim(coalesce(p->>'reference','')),date=d,staff_id=sid,staff_name=sname,expense_month=emonth WHERE id=e.id;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Updated','Updated expense '||e.description||' from '||to_char(e.amount,'FM999,999,999,999,990.00')||' to '||to_char(a,'FM999,999,999,999,990.00')||coalesce(' · '||sname,'')||coalesce(' · '||emonth,''),e.id::text);
 END IF;
 PERFORM public.operation_finish(p,'petty-expense-change',eid);RETURN eid;
END $$;