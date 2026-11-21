CREATE OR REPLACE FUNCTION public.complete_sale(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=coalesce(p->>'branch_id','B1');existing uuid;sid uuid;j jsonb;lines jsonb:='[]';i public.items;price numeric;fp numeric;unit text;paid numeric;phone text;
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
 sid:=public.internal_complete_sale(jsonb_set(p,'{lines}',lines));
 PERFORM public.operation_finish(p,'sale-complete',sid);RETURN sid;
END $$;