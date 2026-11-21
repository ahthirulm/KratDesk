ALTER TABLE public.expense_staff ADD COLUMN payee_type text NOT NULL DEFAULT 'Shop staff';
ALTER TABLE public.expense_staff ADD COLUMN phone text NOT NULL DEFAULT '';
ALTER TABLE public.expense_staff ADD COLUMN note text NOT NULL DEFAULT '';
ALTER TABLE public.expense_staff ADD CONSTRAINT expense_staff_payee_type_check CHECK(payee_type IN('Shop staff','Outside shop'));
ALTER TABLE public.expense_staff ADD CONSTRAINT expense_staff_phone_length CHECK(length(phone)<=40);
ALTER TABLE public.expense_staff ADD CONSTRAINT expense_staff_note_length CHECK(length(note)<=500);
ALTER TABLE public.petty_cash_entries ADD COLUMN staff_type text;
ALTER TABLE public.petty_cash_entries ADD CONSTRAINT petty_expense_staff_type_check CHECK(staff_type IS NULL OR staff_type IN('Shop staff','Outside shop'));

CREATE OR REPLACE FUNCTION public.add_expense_staff(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=nullif(trim(p->>'branch_id'),'');n text:=nullif(trim(p->>'name'),'');sid uuid;existing uuid;ptype text:=coalesce(nullif(trim(p->>'payee_type'),''),'Shop staff');phone text:=trim(coalesce(p->>'phone',''));note text:=trim(coalesce(p->>'note',''));
BEGIN
 IF b IS NULL OR NOT public.staff_can('Manage expenses',b) THEN RAISE EXCEPTION 'Expense management permission required';END IF;
 IF n IS NULL OR length(n)>120 THEN RAISE EXCEPTION 'Enter a valid payee name';END IF;
 IF ptype NOT IN('Shop staff','Outside shop') THEN RAISE EXCEPTION 'Choose shop staff or outside shop';END IF;
 IF length(phone)>40 OR length(note)>500 THEN RAISE EXCEPTION 'Phone or note is too long';END IF;
 existing:=public.operation_begin(p,'expense-staff-save');IF existing IS NOT NULL THEN RETURN existing;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('expense-staff-'||b,0));
 IF EXISTS(SELECT 1 FROM public.expense_staff WHERE branch_id=b AND lower(trim(name))=lower(n)) THEN RAISE EXCEPTION 'This payee profile already exists';END IF;
 INSERT INTO public.expense_staff(branch_id,name,payee_type,phone,note,created_by) VALUES(b,n,ptype,phone,note,auth.uid()) RETURNING id INTO sid;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Payee added','Added '||ptype||' payee '||n,sid::text);
 PERFORM public.operation_finish(p,'expense-staff-save',sid);RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.add_expense_staff(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_expense_staff(jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.record_petty_cash(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id';k text:=p->>'kind';a numeric:=(p->>'amount')::numeric;eid uuid;existing uuid;cat public.petty_cash_categories%ROWTYPE;sid uuid:=nullif(p->>'staff_id','')::uuid;sname text;stype text;emonth text:=nullif(trim(p->>'expense_month'),'');
BEGIN
 IF NOT public.staff_can('Manage expenses',b) THEN RAISE EXCEPTION 'Expense management permission required';END IF;
 existing:=public.operation_begin(p,'petty-cash');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF k<>'Expense' THEN RAISE EXCEPTION 'Top-ups are not available; record shop receipts in main cash instead';END IF;
 IF a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) OR nullif(trim(p->>'description'),'') IS NULL OR length(trim(p->>'description'))>500 THEN RAISE EXCEPTION 'Enter a valid amount and description';END IF;
 a:=round(a,2);PERFORM pg_advisory_xact_lock(hashtextextended('petty-cash-'||b,0));
 SELECT * INTO cat FROM public.petty_cash_categories WHERE branch_id=b AND name=trim(p->>'category') FOR KEY SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Choose an existing expense category';END IF;
 IF cat.requires_staff THEN IF sid IS NULL THEN RAISE EXCEPTION 'Choose a staff member or payee';END IF;SELECT name,payee_type INTO sname,stype FROM public.expense_staff WHERE id=sid AND branch_id=b AND active;IF NOT FOUND THEN RAISE EXCEPTION 'Choose a payee from this branch';END IF;ELSE sid:=NULL;sname:=NULL;stype:=NULL;END IF;
 IF cat.requires_month THEN IF emonth IS NULL OR emonth!~'^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Choose a valid expense month';END IF;ELSE emonth:=NULL;END IF;
 INSERT INTO public.petty_cash_entries(branch_id,kind,amount,category,category_id,description,reference,created_by,staff_id,staff_name,staff_type,expense_month) VALUES(b,k,a,cat.name,cat.id,trim(p->>'description'),trim(coalesce(p->>'reference','')),auth.uid(),sid,sname,stype,emonth) RETURNING id INTO eid;
 PERFORM public.branch_cash_change(b,-a);
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Spent','Spent '||to_char(a,'FM999,999,999,999,990.00')||' — '||trim(p->>'description')||coalesce(' · '||sname,'')||coalesce(' · '||stype,'')||coalesce(' · '||emonth,''),eid::text);
 PERFORM public.operation_finish(p,'petty-cash',eid);RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION public.change_petty_expense(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=nullif(trim(p->>'branch_id'),'');eid uuid:=nullif(p->>'id','')::uuid;action text:=p->>'action';e public.petty_cash_entries%ROWTYPE;cat public.petty_cash_categories%ROWTYPE;a numeric;d date;existing uuid;sid uuid:=nullif(p->>'staff_id','')::uuid;sname text;stype text;emonth text:=nullif(trim(p->>'expense_month'),'');
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
  IF cat.requires_staff THEN IF sid IS NULL THEN RAISE EXCEPTION 'Choose a staff member or payee';END IF;SELECT name,payee_type INTO sname,stype FROM public.expense_staff WHERE id=sid AND branch_id=b AND active;IF NOT FOUND THEN RAISE EXCEPTION 'Choose a payee from this branch';END IF;ELSE sid:=NULL;sname:=NULL;stype:=NULL;END IF;
  IF cat.requires_month THEN IF emonth IS NULL OR emonth!~'^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Choose a valid expense month';END IF;ELSE emonth:=NULL;END IF;
  a:=round(a,2);PERFORM public.branch_cash_change(b,e.amount-a);
  UPDATE public.petty_cash_entries SET amount=a,category=cat.name,category_id=cat.id,description=trim(p->>'description'),reference=trim(coalesce(p->>'reference','')),date=d,staff_id=sid,staff_name=sname,staff_type=stype,expense_month=emonth WHERE id=e.id;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Expenses','Updated','Updated expense '||e.description||' from '||to_char(e.amount,'FM999,999,999,999,990.00')||' to '||to_char(a,'FM999,999,999,999,990.00')||coalesce(' · '||sname,'')||coalesce(' · '||stype,'')||coalesce(' · '||emonth,''),e.id::text);
 END IF;
 PERFORM public.operation_finish(p,'petty-expense-change',eid);RETURN eid;
END $$;