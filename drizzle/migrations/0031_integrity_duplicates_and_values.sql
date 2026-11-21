CREATE UNIQUE INDEX items_tag_normalized_unique ON public.items(lower(trim(tag_id)));
CREATE UNIQUE INDEX branches_name_normalized_unique ON public.branches(lower(trim(name)));
CREATE UNIQUE INDEX metal_types_name_normalized_unique ON public.metal_types(lower(trim(name)));
CREATE UNIQUE INDEX staff_roles_name_normalized_unique ON public.staff_roles(lower(trim(name)));
CREATE UNIQUE INDEX customers_phone_normalized_unique ON public.customers(regexp_replace(phone,'[^0-9]','','g')) WHERE regexp_replace(phone,'[^0-9]','','g')<>'';
CREATE UNIQUE INDEX loans_sale_unique ON public.loans(sale_id);
CREATE UNIQUE INDEX cheque_number_branch_unique ON public.cheque_reminders(branch_id,lower(trim(cheque_number)));

ALTER TABLE public.items ADD CONSTRAINT items_weight_safe CHECK(weight>0 AND weight<=1000000000 AND weight::text NOT IN('NaN','Infinity','-Infinity') AND weight=round(weight,3)) NOT VALID;
ALTER TABLE public.items ADD CONSTRAINT items_tag_safe CHECK(length(trim(tag_id)) BETWEEN 1 AND 80) NOT VALID;
ALTER TABLE public.item_costs ADD CONSTRAINT item_cost_safe CHECK(purchase_price>=0 AND purchase_price<=1000000000000 AND purchase_price::text NOT IN('NaN','Infinity','-Infinity')) NOT VALID;
ALTER TABLE public.sales ADD CONSTRAINT sales_amounts_safe CHECK(calculated_total>=0 AND final_total>0 AND paid_now>=0 AND loan_amount>=0 AND final_total=paid_now+loan_amount AND calculated_total::text NOT IN('NaN','Infinity','-Infinity') AND final_total::text NOT IN('NaN','Infinity','-Infinity') AND paid_now::text NOT IN('NaN','Infinity','-Infinity') AND loan_amount::text NOT IN('NaN','Infinity','-Infinity')) NOT VALID;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_types_safe CHECK(payment_type IN('Full Payment','Full Loan','Cash + Loan') AND payment_method IN('Cash','Card','Bank Transfer','Mixed','Cheque')) NOT VALID;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_values_safe CHECK(weight>0 AND rate_used>0 AND calculated_price>=0 AND final_price>0 AND weight::text NOT IN('NaN','Infinity','-Infinity') AND rate_used::text NOT IN('NaN','Infinity','-Infinity') AND calculated_price::text NOT IN('NaN','Infinity','-Infinity') AND final_price::text NOT IN('NaN','Infinity','-Infinity')) NOT VALID;
ALTER TABLE public.sale_costs ADD CONSTRAINT sale_costs_values_safe CHECK(purchase_cost>=0 AND purchase_cost::text NOT IN('NaN','Infinity','-Infinity')) NOT VALID;
ALTER TABLE public.loans ADD CONSTRAINT loans_values_safe CHECK(amount>0 AND amount::text NOT IN('NaN','Infinity','-Infinity') AND frequency IN('Monthly','Every 2 weeks','Weekly') AND (status IS NULL OR status IN('Active','Closed','Cancelled'))) NOT VALID;
ALTER TABLE public.loan_installments ADD CONSTRAINT installments_values_safe CHECK(installment_no BETWEEN 1 AND 120 AND amount>0 AND amount::text NOT IN('NaN','Infinity','-Infinity')) NOT VALID;
ALTER TABLE public.loan_payments ADD CONSTRAINT payments_values_safe CHECK(amount>0 AND amount<=1000000000000 AND amount::text NOT IN('NaN','Infinity','-Infinity') AND method IN('Cash','Card','Bank Transfer','Mixed','Cheque')) NOT VALID;
ALTER TABLE public.customers ADD CONSTRAINT customers_values_safe CHECK(length(trim(name)) BETWEEN 1 AND 160 AND length(trim(phone)) BETWEEN 7 AND 30) NOT VALID;
ALTER TABLE public.branches ADD CONSTRAINT branches_values_safe CHECK(length(trim(name)) BETWEEN 1 AND 160 AND code~'^[A-Z0-9]{1,12}$') NOT VALID;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_values_safe CHECK(length(trim(name)) BETWEEN 1 AND 200 AND length(name)<=200 AND length(contact_person)<=160 AND length(phone)<=40 AND length(address)<=500) NOT VALID;
ALTER TABLE public.settings ADD CONSTRAINT settings_values_safe CHECK(length(trim(shop_name)) BETWEEN 1 AND 160 AND length(trim(coalesce(currency,''))) BETWEEN 1 AND 12 AND length(trim(country)) BETWEEN 1 AND 80 AND print_paper IN('58mm','80mm','A5','A4') AND inactivity_minutes IN(5,15,30,60,120,240,480)) NOT VALID;
ALTER TABLE public.cheque_reminders ADD CONSTRAINT cheque_values_safe CHECK(length(trim(cheque_number)) BETWEEN 1 AND 80 AND amount>0 AND amount::text NOT IN('NaN','Infinity','-Infinity') AND ((sale_id IS NOT NULL AND payment_id IS NULL) OR (sale_id IS NULL AND payment_id IS NOT NULL))) NOT VALID;

CREATE TABLE public.operation_requests(
 actor_id uuid NOT NULL,
 kind text NOT NULL,
 request_id uuid NOT NULL,
 payload_hash text NOT NULL,
 result_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,kind,request_id)
);
GRANT ALL ON public.operation_requests TO service_role;
ALTER TABLE public.operation_requests ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.operation_begin(p jsonb,kind text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE key uuid;existing uuid;stored_hash text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Staff login required';END IF;
 IF nullif(p->>'request_id','') IS NULL THEN RETURN NULL;END IF;
 key:=(p->>'request_id')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||kind||':'||key::text,0));
 SELECT result_id,payload_hash INTO existing,stored_hash FROM public.operation_requests WHERE actor_id=auth.uid() AND kind=operation_begin.kind AND request_id=key;
 IF FOUND THEN
  IF stored_hash<>md5((p-'request_id')::text) THEN RAISE EXCEPTION 'This request key was already used for different details';END IF;
  RETURN existing;
 END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION public.operation_finish(p jsonb,kind text,result uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF nullif(p->>'request_id','') IS NOT NULL THEN
  INSERT INTO public.operation_requests(actor_id,kind,request_id,payload_hash,result_id) VALUES(auth.uid(),kind,(p->>'request_id')::uuid,md5((p-'request_id')::text),result);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.operation_begin(jsonb,text),public.operation_finish(jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.operation_begin(jsonb,text),public.operation_finish(jsonb,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.save_supplier(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());n text:=nullif(trim(p->>'name'),'');existing uuid;
BEGIN
 IF NOT public.staff_can('Manage suppliers') THEN RAISE EXCEPTION 'Supplier management permission required';END IF;
 existing:=public.operation_begin(p,'supplier-save');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF n IS NULL OR length(n)>200 OR length(coalesce(p->>'contact_person',''))>160 OR length(coalesce(p->>'phone',''))>40 OR length(coalesce(p->>'address',''))>500 THEN RAISE EXCEPTION 'Enter a supplier name within the allowed field lengths';END IF;
 IF EXISTS(SELECT 1 FROM public.suppliers WHERE lower(trim(name))=lower(n) AND id<>sid) THEN RAISE EXCEPTION 'This supplier name is already in use';END IF;
 INSERT INTO public.suppliers(id,name,contact_person,phone,address,active) VALUES(sid,n,trim(coalesce(p->>'contact_person','')),trim(coalesce(p->>'phone','')),trim(coalesce(p->>'address','')),coalesce((p->>'active')::boolean,true)) ON CONFLICT(id) DO UPDATE SET name=excluded.name,contact_person=excluded.contact_person,phone=excluded.phone,address=excluded.address,active=excluded.active;
 PERFORM public.operation_finish(p,'supplier-save',sid);RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.save_supplier(jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.save_supplier(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.manage_metal(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid:=nullif(p->>'id','')::uuid;n text:=nullif(trim(p->>'name'),'');oldname text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Owner access required';END IF;
 IF p->>'action'='Remove' THEN
  SELECT name INTO oldname FROM public.metal_types WHERE id=mid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Metal type not found';END IF;
  IF EXISTS(SELECT 1 FROM public.items WHERE metal_id=mid) THEN RAISE EXCEPTION 'Reassign stock using % before removing this metal type',oldname;END IF;
  IF EXISTS(SELECT 1 FROM public.daily_rates WHERE metal_id=mid) THEN RAISE EXCEPTION 'Remove this metal type’s daily-rate history before removing it';END IF;
  DELETE FROM public.metal_types WHERE id=mid;
 ELSE
  IF n IS NULL OR length(n)>100 THEN RAISE EXCEPTION 'Enter a metal name up to 100 characters';END IF;
  IF EXISTS(SELECT 1 FROM public.metal_types WHERE lower(trim(name))=lower(n) AND id IS DISTINCT FROM mid) THEN RAISE EXCEPTION 'This metal type already exists';END IF;
  IF mid IS NULL THEN INSERT INTO public.metal_types(name) VALUES(n) RETURNING id INTO mid;ELSE UPDATE public.metal_types SET name=n WHERE id=mid;END IF;
 END IF;
 RETURN mid;
END $$;
REVOKE ALL ON FUNCTION public.manage_metal(jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.manage_metal(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_customer(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());cname text:=nullif(trim(p->>'name'),'');cphone text:=nullif(trim(p->>'phone'),'');digits text;existing uuid;
BEGIN
 IF NOT public.staff_can('View customers') THEN RAISE EXCEPTION 'Customer management permission required';END IF;
 existing:=public.operation_begin(p,'customer-save');IF existing IS NOT NULL THEN RETURN existing;END IF;
 digits:=regexp_replace(coalesce(cphone,''),'[^0-9]','','g');
 IF cname IS NULL OR length(cname)>160 OR cphone IS NULL OR length(cphone)>30 OR cphone !~ '^[0-9+()[:space:]-]+$' OR length(digits)<7 OR length(digits)>20 THEN RAISE EXCEPTION 'Enter a valid customer name and phone number';END IF;
 IF EXISTS(SELECT 1 FROM public.customers WHERE regexp_replace(phone,'[^0-9]','','g')=digits AND id<>cid) THEN RAISE EXCEPTION 'This phone belongs to another customer';END IF;
 INSERT INTO public.customers(id,name,phone) VALUES(cid,cname,cphone) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone;
 PERFORM public.operation_finish(p,'customer-save',cid);RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.save_item(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=coalesce(p->>'branch_id','B1');w numeric:=(p->>'weight')::numeric;cost numeric:=(p->>'purchase_price')::numeric;tag text:=nullif(trim(p->>'tag_id'),'');n text:=nullif(trim(p->>'name'),'');iid uuid;existing uuid;
BEGIN
 IF NOT public.staff_can('Manage stock',b) THEN RAISE EXCEPTION 'Stock management permission required';END IF;
 existing:=public.operation_begin(p,'stock-save');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.branches WHERE id=b AND active) THEN RAISE EXCEPTION 'Choose an active branch';END IF;
 IF tag IS NULL OR length(tag)>80 OR n IS NULL OR length(n)>200 THEN RAISE EXCEPTION 'Enter an internal tag and item name within the allowed lengths';END IF;
 IF w IS NULL OR w<=0 OR w>1000000000 OR w::text IN('NaN','Infinity','-Infinity') OR w<>round(w,3) THEN RAISE EXCEPTION 'Enter a positive weight with at most 3 decimals';END IF;
 IF cost IS NULL OR cost<0 OR cost>1000000000000 OR cost::text IN('NaN','Infinity','-Infinity') OR cost<>round(cost,2) THEN RAISE EXCEPTION 'Enter a valid non-negative purchase price with at most 2 decimals';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.metal_types WHERE id=(p->>'metal_id')::uuid) THEN RAISE EXCEPTION 'Choose an existing metal type';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stock_categories WHERE name=coalesce(p->>'category','Other')) THEN RAISE EXCEPTION 'Choose an existing stock category';END IF;
 IF p->>'id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.items WHERE id=(p->>'id')::uuid AND branch_id=b AND status='In Stock') THEN RAISE EXCEPTION 'Only an in-stock piece in this branch can be edited';END IF;
 PERFORM set_config('app.branch_id',b,true);
 iid:=public.internal_save_item(jsonb_set(p,'{tag_id}',to_jsonb(tag)));
 PERFORM public.operation_finish(p,'stock-save',iid);RETURN iid;
END $$;

CREATE OR REPLACE FUNCTION public.delete_item(iid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.items;
BEGIN
 SELECT * INTO i FROM public.items WHERE id=iid FOR UPDATE;
 IF NOT FOUND OR NOT public.staff_can('Manage stock',i.branch_id) THEN RAISE EXCEPTION 'Stock management permission required';END IF;
 IF i.status<>'In Stock' OR EXISTS(SELECT 1 FROM public.sale_items WHERE item_id=iid) THEN RAISE EXCEPTION 'This piece belongs to sales history. Void or return its original bill before changing stock';END IF;
 IF EXISTS(SELECT 1 FROM public.stock_movements WHERE item_id=iid) THEN RAISE EXCEPTION 'This piece has transfer history and must remain for audit; deletion is blocked';END IF;
 DELETE FROM public.items WHERE id=iid;
END $$;

CREATE OR REPLACE FUNCTION public.complete_sale(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=coalesce(p->>'branch_id','B1');existing uuid;sid uuid;j jsonb;lines jsonb:='[]';i public.items;price numeric;w numeric;fp numeric;unit text;paid numeric;phone text;
BEGIN
 IF NOT public.staff_can('Create bills',b) THEN RAISE EXCEPTION 'Billing permission required';END IF;
 existing:=public.operation_begin(p,'sale-complete');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.branches WHERE id=b AND active) THEN RAISE EXCEPTION 'Choose an active branch';END IF;
 IF p->'lines' IS NULL OR jsonb_typeof(p->'lines')<>'array' OR jsonb_array_length(p->'lines')<1 OR jsonb_array_length(p->'lines')>200 THEN RAISE EXCEPTION 'Add between 1 and 200 pieces';END IF;
 FOR j IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
  SELECT * INTO i FROM public.items WHERE id=(j->>'id')::uuid;
  IF NOT FOUND OR i.branch_id<>b THEN RAISE EXCEPTION 'Every piece must belong to the billing branch';END IF;
  price:=(j->>'unit_price')::numeric;unit:=j->>'price_unit';
  IF price IS NULL OR price<=0 OR price>1000000000000 OR price::text IN('NaN','Infinity','-Infinity') OR price<>round(price,2) OR unit NOT IN('Gram','Pound (8g)') THEN RAISE EXCEPTION 'Enter a valid positive unit price with at most 2 decimals';END IF;
  fp:=round(i.weight*price/CASE WHEN unit='Pound (8g)' THEN 8 ELSE 1 END,2);
  IF fp<=0 THEN RAISE EXCEPTION 'Each piece must have a positive final price';END IF;
  lines:=lines||jsonb_build_array(jsonb_build_object('id',i.id,'unit_price',price,'price_unit',unit,'rate_used',round(price/CASE WHEN unit='Pound (8g)' THEN 8 ELSE 1 END,2),'final_price',fp));
 END LOOP;
 paid:=round(coalesce(nullif(p->>'paid_now','')::numeric,0),2);
 IF paid<0 OR paid>1000000000000 OR paid::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a valid amount paid now';END IF;
 phone:=nullif(trim(p->>'customer_phone'),'');
 IF phone IS NOT NULL AND (phone !~ '^[0-9+()[:space:]-]+$' OR length(regexp_replace(phone,'[^0-9]','','g')) NOT BETWEEN 7 AND 20) THEN RAISE EXCEPTION 'Enter a valid customer phone number';END IF;
 IF length(coalesce(p->>'customer_name',''))>160 OR length(coalesce(p->>'cheque_number',''))>80 THEN RAISE EXCEPTION 'Customer or cheque details are too long';END IF;
 PERFORM set_config('app.branch_id',b,true);PERFORM set_config('app.cheque_payment',p::text,true);PERFORM set_config('app.sale_lines',lines::text,true);
 sid:=public.internal_complete_sale(jsonb_set(p,'lines',lines));
 PERFORM public.operation_finish(p,'sale-complete',sid);RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.record_payment(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=coalesce(p->>'branch_id','B1');a numeric:=(p->>'amount')::numeric;existing uuid;rid uuid;
BEGIN
 IF NOT public.staff_can('Collect repayments',b) THEN RAISE EXCEPTION 'Collection permission required';END IF;
 existing:=public.operation_begin(p,'loan-payment');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) THEN RAISE EXCEPTION 'Enter a positive repayment amount with at most 2 decimals';END IF;
 IF p->>'method' NOT IN('Cash','Card','Bank Transfer','Mixed','Cheque') THEN RAISE EXCEPTION 'Choose a valid payment method';END IF;
 PERFORM set_config('app.branch_id',b,true);PERFORM set_config('app.cheque_payment',p::text,true);
 rid:=public.internal_record_payment(p);PERFORM public.operation_finish(p,'loan-payment',rid);RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.record_petty_cash(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id';k text:=p->>'kind';a numeric:=(p->>'amount')::numeric;bal numeric;eid uuid;existing uuid;
BEGIN
 IF NOT public.staff_can('Manage expenses',b) THEN RAISE EXCEPTION 'Expense management permission required';END IF;
 existing:=public.operation_begin(p,'petty-cash');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF k NOT IN('Top-up','Expense') OR a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) OR nullif(trim(p->>'description'),'') IS NULL OR length(trim(p->>'description'))>500 THEN RAISE EXCEPTION 'Enter a valid amount and description';END IF;
 a:=round(a,2);PERFORM pg_advisory_xact_lock(hashtextextended('petty-cash-'||b,0));
 SELECT coalesce(sum(CASE WHEN kind='Top-up' THEN amount ELSE -amount END),0) INTO bal FROM public.petty_cash_entries WHERE branch_id=b;
 IF k='Expense' AND a>bal THEN RAISE EXCEPTION 'Expense exceeds available petty cash';END IF;
 INSERT INTO public.petty_cash_entries(branch_id,kind,amount,category,description,reference,created_by) VALUES(b,k,a,coalesce(nullif(trim(p->>'category'),''),'Other'),trim(p->>'description'),trim(coalesce(p->>'reference','')),auth.uid()) RETURNING id INTO eid;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Petty cash',CASE WHEN k='Top-up' THEN 'Funded' ELSE 'Spent' END,CASE WHEN k='Top-up' THEN 'Added ' ELSE 'Spent ' END||to_char(a,'FM999,999,999,999,990.00')||' — '||trim(p->>'description'),eid::text);
 PERFORM public.operation_finish(p,'petty-cash',eid);RETURN eid;
END $$;

COMMENT ON TABLE public.operation_requests IS 'Private idempotency keys preventing accidental duplicate financial and directory writes on retries.';
COMMENT ON FUNCTION public.complete_sale(jsonb) IS 'Validates branch stock, finite unit prices and customer fields, derives server-side line totals, and safely deduplicates request retries.';