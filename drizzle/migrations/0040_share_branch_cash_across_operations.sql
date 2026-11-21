CREATE OR REPLACE FUNCTION public.branch_cash_change(p_branch text,p_amount numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bal numeric;
BEGIN
 IF p_amount IS NULL OR abs(p_amount)>1000000000000 OR p_amount::text IN('NaN','Infinity','-Infinity') OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'Invalid branch cash amount';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.branches WHERE id=p_branch AND active) THEN RAISE EXCEPTION 'Choose an active branch';END IF;
 IF p_amount=0 THEN RETURN;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('branch-cash-'||p_branch,0));
 INSERT INTO public.fx_accounts(branch_id,currency) VALUES(p_branch,'LKR') ON CONFLICT(branch_id,currency) DO NOTHING;
 SELECT balance INTO bal FROM public.fx_accounts WHERE branch_id=p_branch AND currency='LKR' FOR UPDATE;
 IF bal+p_amount<0 THEN RAISE EXCEPTION 'Insufficient branch cash for this transaction';END IF;
 UPDATE public.fx_accounts SET balance=round(balance+p_amount,2) WHERE branch_id=p_branch AND currency='LKR';
END $$;
REVOKE ALL ON FUNCTION public.branch_cash_change(text,numeric) FROM PUBLIC,anon,authenticated;

INSERT INTO public.fx_accounts(branch_id,currency)
SELECT id,'LKR' FROM public.branches
ON CONFLICT(branch_id,currency) DO NOTHING;

WITH deltas AS (
 SELECT branch_id,sum(delta) AS delta FROM (
  SELECT branch_id,paid_now AS delta FROM public.sales
  UNION ALL SELECT branch_id,amount AS delta FROM public.loan_payments
  UNION ALL SELECT branch_id,-refund_amount AS delta FROM public.sale_reversals
  UNION ALL SELECT branch_id,CASE WHEN kind='Sell' THEN total_lkr ELSE -total_lkr END AS delta FROM public.old_gold_entries
  UNION ALL SELECT branch_id,CASE WHEN kind='Top-up' THEN amount ELSE -amount END AS delta FROM public.petty_cash_entries
 ) all_cash GROUP BY branch_id
)
UPDATE public.fx_accounts account
SET balance=round(account.balance+deltas.delta,2)
FROM deltas
WHERE account.branch_id=deltas.branch_id AND account.currency='LKR';

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
 PERFORM public.branch_cash_change(b,paid);
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
 rid:=public.internal_record_payment(p);
 PERFORM public.branch_cash_change(b,a);
 PERFORM public.operation_finish(p,'loan-payment',rid);RETURN rid;
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
 PERFORM public.branch_cash_change(b,CASE WHEN k='Top-up' THEN a ELSE -a END);
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),b,'Petty cash',CASE WHEN k='Top-up' THEN 'Funded' ELSE 'Spent' END,CASE WHEN k='Top-up' THEN 'Added ' ELSE 'Spent ' END||to_char(a,'FM999,999,999,999,990.00')||' — '||trim(p->>'description'),eid::text);
 PERFORM public.operation_finish(p,'petty-cash',eid);RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION public.delete_sale(sid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.sales;loan text;cheque text;moved integer;line_count integer;
BEGIN
 SELECT * INTO s FROM public.sales WHERE id=sid FOR UPDATE;
 IF NOT FOUND OR NOT public.staff_can('Manage settings',s.branch_id) THEN RAISE EXCEPTION 'Owner permission required for this branch';END IF;
 SELECT loan_no INTO loan FROM public.loans WHERE sale_id=sid;
 IF loan IS NOT NULL THEN RAISE EXCEPTION 'Loan % is linked to this sale. Use Void bill so loan and sales reports remain correct; deletion is blocked',loan;END IF;
 IF EXISTS(SELECT 1 FROM public.sale_reversals WHERE sale_id=sid) THEN RAISE EXCEPTION 'This bill has return or void history and must remain for accurate reports';END IF;
 SELECT cheque_number INTO cheque FROM public.cheque_reminders WHERE sale_id=sid LIMIT 1;
 IF cheque IS NOT NULL THEN RAISE EXCEPTION 'Cheque % is linked to this sale. Use Void bill to retain the cheque and payment history',cheque;END IF;
 SELECT count(*) INTO line_count FROM public.sale_items WHERE sale_id=sid;
 PERFORM 1 FROM public.items WHERE id IN(SELECT item_id FROM public.sale_items WHERE sale_id=sid) ORDER BY id FOR UPDATE;
 UPDATE public.items SET status='In Stock',sold_invoice=NULL WHERE id IN(SELECT item_id FROM public.sale_items WHERE sale_id=sid) AND status='Sold' AND sold_invoice=s.invoice_no;
 GET DIAGNOSTICS moved=ROW_COUNT;IF moved<>line_count THEN RAISE EXCEPTION 'A piece has changed or has later history. Keep this bill and use a return instead';END IF;
 PERFORM public.branch_cash_change(s.branch_id,-s.paid_now);
 DELETE FROM public.sale_costs WHERE sale_item_id IN(SELECT id FROM public.sale_items WHERE sale_id=sid);
 DELETE FROM public.sale_items WHERE sale_id=sid;
 DELETE FROM public.sales WHERE id=sid;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),s.branch_id,'Sales','Deleted','Deleted standalone bill '||s.invoice_no||' · original total '||s.final_total||' · no loan, cheque, return or repayment history',sid::text);
END $$;

CREATE OR REPLACE FUNCTION public.reverse_sale(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid:=(p->>'sale_id')::uuid;s public.sales;l public.loans;action text:=p->>'kind';reason_text text:=trim(coalesce(p->>'reason',''));method text:=coalesce(p->>'refund_method','No refund');existing uuid;rid uuid;line record;line_count integer;total numeric;calc numeric;prevPaid numeric;prevCredit numeric;prevLoan numeric;prevPaymentRefund numeric;paid numeric;paidReduction numeric;creditReduction numeric;loanReduction numeric;paymentRefund numeric;refund numeric;outstanding numeric;newOutstanding numeric;effectivePaid numeric;plan jsonb;duePlan jsonb;base numeric;due date;firstdate date;n integer;k integer;moved integer;
BEGIN
 SELECT * INTO s FROM public.sales WHERE id=sid FOR UPDATE;
 IF NOT FOUND OR NOT public.staff_can('Manage settings',s.branch_id) THEN RAISE EXCEPTION 'Owner permission required for this branch';END IF;
 existing:=public.operation_begin(p,'sale-reversal');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF action NOT IN('Void','Return') OR length(reason_text)<3 OR length(reason_text)>500 THEN RAISE EXCEPTION 'Enter a return or void reason between 3 and 500 characters';END IF;
 IF action='Void' AND EXISTS(SELECT 1 FROM public.sale_reversals WHERE sale_id=sid) THEN RAISE EXCEPTION 'This bill already has return or void history. Keep its history or return any remaining pieces';END IF;
 IF action='Return' AND EXISTS(SELECT 1 FROM public.sale_reversals WHERE sale_id=sid AND kind='Void') THEN RAISE EXCEPTION 'This bill is already voided';END IF;
 IF action='Return' AND (p->'line_ids' IS NULL OR jsonb_typeof(p->'line_ids')<>'array' OR jsonb_array_length(p->'line_ids')<1) THEN RAISE EXCEPTION 'Select at least one piece to return';END IF;
 IF action='Return' AND (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p->'line_ids'))<>jsonb_array_length(p->'line_ids') THEN RAISE EXCEPTION 'A piece can only be selected once';END IF;
 SELECT count(*),coalesce(sum(final_price),0),coalesce(sum(calculated_price),0) INTO line_count,total,calc FROM public.sale_items si WHERE si.sale_id=sid AND (action='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids')));
 IF line_count=0 OR (action='Return' AND line_count<>jsonb_array_length(p->'line_ids')) THEN RAISE EXCEPTION 'Selected pieces do not belong to this bill';END IF;
 IF action='Void' AND line_count<>(SELECT count(*) FROM public.sale_items WHERE sale_id=sid) THEN RAISE EXCEPTION 'All bill pieces must be included in a void';END IF;
 PERFORM 1 FROM public.items WHERE id IN(SELECT item_id FROM public.sale_items si WHERE si.sale_id=sid AND (action='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids')))) ORDER BY id FOR UPDATE;
 FOR line IN SELECT si.id AS sale_item_id,i.id AS item_id,i.status,i.sold_invoice FROM public.sale_items si JOIN public.items i ON i.id=si.item_id WHERE si.sale_id=sid AND (action='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids'))) LOOP
  IF line.status<>'Sold' OR line.sold_invoice IS DISTINCT FROM s.invoice_no THEN RAISE EXCEPTION 'A selected piece has already been returned or changed by another transaction';END IF;
 END LOOP;
 SELECT coalesce(sum(paid_reduction),0),coalesce(sum(credit_reduction),0),coalesce(sum(loan_reduction),0),coalesce(sum(payment_refund),0) INTO prevPaid,prevCredit,prevLoan,prevPaymentRefund FROM public.sale_reversals WHERE sale_id=sid;
 SELECT * INTO l FROM public.loans WHERE sale_id=sid FOR UPDATE;
 paidReduction:=least(total,greatest(s.paid_now-prevPaid,0));creditReduction:=total-paidReduction;
 IF l.id IS NULL THEN
  IF creditReduction<>0 THEN RAISE EXCEPTION 'Return allocation exceeds the amount paid for this bill';END IF;
  loanReduction:=0;paymentRefund:=0;paid:=0;outstanding:=0;
 ELSE
  SELECT coalesce(sum(amount),0) INTO paid FROM public.loan_payments WHERE loan_id=l.id;
  outstanding:=greatest(l.amount-prevLoan-paid,0);
  loanReduction:=least(creditReduction,outstanding);paymentRefund:=creditReduction-loanReduction;
  IF paymentRefund>greatest(paid-prevPaymentRefund,0) THEN RAISE EXCEPTION 'Return allocation exceeds the refundable repayment amount';END IF;
 END IF;
 refund:=paidReduction+paymentRefund;
 IF (refund>0 AND method NOT IN('Cash','Card','Bank Transfer')) OR (refund=0 AND method<>'No refund') THEN RAISE EXCEPTION 'Choose the refund method, or No refund when nothing is repayable';END IF;
 PERFORM public.branch_cash_change(s.branch_id,-refund);
 INSERT INTO public.sale_reversals(sale_id,branch_id,kind,reason,refund_method,total_amount,paid_reduction,credit_reduction,loan_reduction,payment_refund,refund_amount,created_by) VALUES(sid,s.branch_id,action,reason_text,method,total,paidReduction,creditReduction,loanReduction,paymentRefund,refund,auth.uid()) RETURNING id INTO rid;
 INSERT INTO public.sale_reversal_items(reversal_id,sale_item_id,item_id,amount,calculated_amount,purchase_cost) SELECT rid,si.id,si.item_id,si.final_price,si.calculated_price,coalesce(sc.purchase_cost,0) FROM public.sale_items si LEFT JOIN public.sale_costs sc ON sc.sale_item_id=si.id WHERE si.sale_id=sid AND (action='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids')));
 UPDATE public.items SET status='In Stock',sold_invoice=NULL WHERE id IN(SELECT item_id FROM public.sale_items si WHERE si.sale_id=sid AND (action='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids')))) AND status='Sold' AND sold_invoice=s.invoice_no;
 GET DIAGNOSTICS moved=ROW_COUNT;IF moved<>line_count THEN RAISE EXCEPTION 'Stock changed during the return; nothing was saved';END IF;
 IF l.id IS NOT NULL THEN
  newOutstanding:=greatest(l.amount-prevLoan-loanReduction-paid,0);
  IF action='Void' THEN UPDATE public.loans SET status='Cancelled' WHERE id=l.id;
  ELSIF newOutstanding=0 THEN UPDATE public.loans SET status='Closed' WHERE id=l.id;
  ELSE
   UPDATE public.loans SET status='Active' WHERE id=l.id;
   effectivePaid:=paid-prevPaymentRefund-paymentRefund;
   SELECT schedule INTO plan FROM public.loan_term_revisions WHERE loan_id=l.id ORDER BY created_at DESC LIMIT 1;
   IF plan IS NULL THEN SELECT jsonb_agg(jsonb_build_object('installment_no',installment_no,'due_date',due_date,'amount',amount) ORDER BY installment_no) INTO plan FROM public.loan_installments WHERE loan_id=l.id;END IF;
   SELECT jsonb_agg(value ORDER BY (value->>'installment_no')::integer) INTO duePlan FROM jsonb_array_elements(coalesce(plan,'[]')) value WHERE (value->>'installment_no')::integer>0;
   n:=least(coalesce(jsonb_array_length(duePlan),0),floor(newOutstanding*100)::integer);
   IF n<1 THEN RAISE EXCEPTION 'No valid installment dates remain; adjust the loan before returning these pieces';END IF;
   plan:=CASE WHEN effectivePaid>0 THEN jsonb_build_array(jsonb_build_object('installment_no',0,'due_date',(now() AT TIME ZONE 'Asia/Colombo')::date,'amount',effectivePaid)) ELSE '[]'::jsonb END;
   base:=floor(newOutstanding*100/n)/100;firstdate:=(duePlan->0->>'due_date')::date;
   FOR k IN 1..n LOOP due:=(duePlan->(k-1)->>'due_date')::date;plan:=plan||jsonb_build_array(jsonb_build_object('installment_no',k,'due_date',due,'amount',CASE WHEN k=n THEN newOutstanding-base*(n-1) ELSE base END));END LOOP;
   INSERT INTO public.loan_term_revisions(loan_id,frequency,installment_count,first_due,paid_at_revision,schedule,created_by) VALUES(l.id,l.frequency,n,firstdate,effectivePaid,plan,auth.uid());
  END IF;
 END IF;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),s.branch_id,'Sales',action,CASE WHEN action='Void' THEN 'Voided bill ' ELSE 'Returned pieces on ' END||s.invoice_no||' · value '||total||' · refund '||refund||' · '||reason_text,sid::text);
 PERFORM public.operation_finish(p,'sale-reversal',rid);RETURN rid;
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
 IF k='Buy' THEN c:=t;PERFORM public.branch_cash_change(b,-t);UPDATE public.old_gold_accounts SET weight=weight+w,cost_lkr=cost_lkr+t WHERE branch_id=b AND purity=q;
 ELSE IF holding.weight<w THEN RAISE EXCEPTION 'Sale exceeds available old-gold weight for this purity';END IF;c:=CASE WHEN w=holding.weight THEN holding.cost_lkr ELSE round(holding.cost_lkr*w/holding.weight,2) END;profit:=t-c;UPDATE public.old_gold_accounts SET weight=weight-w,cost_lkr=cost_lkr-c WHERE branch_id=b AND purity=q;PERFORM public.branch_cash_change(b,t);END IF;
 INSERT INTO public.old_gold_entries(branch_id,purity,kind,weight,pricing_unit,unit_price,total_lkr,cost_lkr,profit_lkr,customer_name,customer_phone,method,reference,note,created_by) VALUES(b,q,k,w,u,price,t,c,profit,trim(coalesce(p->>'customer_name','')),trim(coalesce(p->>'customer_phone','')),m,trim(coalesce(p->>'reference','')),trim(coalesce(p->>'note','')),auth.uid()) RETURNING id INTO eid;
 PERFORM public.operation_finish(p,'old-gold-entry',eid);RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION public.record_fx_entry(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text:=p->>'branch_id';c text:=upper(trim(p->>'currency'));k text:=p->>'kind';a numeric:=(p->>'amount')::numeric;r numeric:=(p->>'rate')::numeric;t numeric;cost numeric:=0;profit numeric:=0;holding public.fx_accounts;eid uuid;existing uuid;
BEGIN
 IF NOT public.staff_can('Manage currency exchange',b) THEN RAISE EXCEPTION 'Currency exchange permission required';END IF;
 existing:=public.operation_begin(p,'currency-entry');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.branches WHERE id=b AND active) THEN RAISE EXCEPTION 'Choose an active branch';END IF;
 IF k IS NULL OR k NOT IN('Buy','Sell') OR a IS NULL OR a<=0 OR a>1000000000000 OR a::text IN('NaN','Infinity','-Infinity') OR a<>round(a,2) OR r IS NULL OR r<=0 OR r>1000000000000 OR r::text IN('NaN','Infinity','-Infinity') OR r<>round(r,6) THEN RAISE EXCEPTION 'Enter a positive amount (up to 2 decimals) and rate (up to 6 decimals)';END IF;
 IF length(coalesce(p->>'counterparty',''))>160 OR length(coalesce(p->>'reference',''))>120 OR length(coalesce(p->>'note',''))>1000 THEN RAISE EXCEPTION 'Customer, reference or note is too long';END IF;
 IF c='LKR' THEN RAISE EXCEPTION 'Choose a foreign currency';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('fx-directory',0));
 IF c IS NULL OR NOT EXISTS(SELECT 1 FROM public.fx_currencies WHERE code=c AND active) THEN RAISE EXCEPTION 'Choose an active currency';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('fx-branch-'||b,0));
 INSERT INTO public.fx_accounts(branch_id,currency) VALUES(b,c) ON CONFLICT(branch_id,currency) DO NOTHING;
 SELECT * INTO holding FROM public.fx_accounts WHERE branch_id=b AND currency=c FOR UPDATE;
 t:=round(a*r,2);IF t<=0 THEN RAISE EXCEPTION 'Total must be at least 0.01';END IF;
 IF k='Buy' THEN
  PERFORM public.branch_cash_change(b,-t);
  UPDATE public.fx_accounts SET balance=balance+a,cost_lkr=cost_lkr+t WHERE branch_id=b AND currency=c;cost:=t;
 ELSE
  IF holding.balance<a THEN RAISE EXCEPTION 'Insufficient foreign currency balance';END IF;
  cost:=CASE WHEN a=holding.balance THEN holding.cost_lkr ELSE round(holding.cost_lkr*a/holding.balance,2) END;profit:=t-cost;
  UPDATE public.fx_accounts SET balance=balance-a,cost_lkr=cost_lkr-cost WHERE branch_id=b AND currency=c;
  PERFORM public.branch_cash_change(b,t);
 END IF;
 INSERT INTO public.fx_entries(branch_id,currency,kind,amount,rate,lkr_total,cost_lkr,profit_lkr,counterparty,reference,note,created_by) VALUES(b,c,k,a,r,t,cost,profit,trim(coalesce(p->>'counterparty','')),trim(coalesce(p->>'reference','')),trim(coalesce(p->>'note','')),auth.uid()) RETURNING id INTO eid;
 PERFORM public.operation_finish(p,'currency-entry',eid);RETURN eid;
END $$;

COMMENT ON FUNCTION public.branch_cash_change(text,numeric) IS 'Internal serialized branch-cash posting shared by jewellery, repayments, old gold, petty cash, refunds and foreign-currency trades.';