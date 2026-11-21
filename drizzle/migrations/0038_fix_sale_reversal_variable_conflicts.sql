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