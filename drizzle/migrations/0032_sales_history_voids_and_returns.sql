CREATE TABLE public.sale_reversals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sale_id uuid NOT NULL REFERENCES public.sales(id),
 branch_id text NOT NULL REFERENCES public.branches(id),
 kind text NOT NULL CHECK(kind IN('Void','Return')),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),
 refund_method text NOT NULL CHECK(refund_method IN('Cash','Card','Bank Transfer','No refund')),
 total_amount numeric(16,2) NOT NULL CHECK(total_amount>0 AND total_amount::text NOT IN('NaN','Infinity','-Infinity')),
 paid_reduction numeric(16,2) NOT NULL CHECK(paid_reduction>=0),
 credit_reduction numeric(16,2) NOT NULL CHECK(credit_reduction>=0),
 loan_reduction numeric(16,2) NOT NULL CHECK(loan_reduction>=0),
 payment_refund numeric(16,2) NOT NULL CHECK(payment_refund>=0),
 refund_amount numeric(16,2) NOT NULL CHECK(refund_amount>=0 AND refund_amount=paid_reduction+payment_refund),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sale_reversals TO authenticated;GRANT ALL ON public.sale_reversals TO service_role;
ALTER TABLE public.sale_reversals ENABLE ROW LEVEL SECURITY;
CREATE POLICY sale_reversals_read ON public.sale_reversals FOR SELECT TO authenticated USING(public.staff_can('Create bills',branch_id) OR public.staff_can('View reports',branch_id) OR public.staff_can('Manage settings',branch_id));
CREATE UNIQUE INDEX one_void_per_sale ON public.sale_reversals(sale_id) WHERE kind='Void';
CREATE INDEX sale_reversals_branch_date ON public.sale_reversals(branch_id,created_at);

CREATE TABLE public.sale_reversal_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reversal_id uuid NOT NULL REFERENCES public.sale_reversals(id),
 sale_item_id uuid NOT NULL UNIQUE REFERENCES public.sale_items(id),
 item_id uuid NOT NULL REFERENCES public.items(id),
 amount numeric(16,2) NOT NULL CHECK(amount>0),
 calculated_amount numeric(16,2) NOT NULL CHECK(calculated_amount>=0),
 purchase_cost numeric(16,2) NOT NULL DEFAULT 0 CHECK(purchase_cost>=0)
);
GRANT SELECT ON public.sale_reversal_items TO authenticated;GRANT ALL ON public.sale_reversal_items TO service_role;
ALTER TABLE public.sale_reversal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sale_reversal_items_read ON public.sale_reversal_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.sale_reversals r WHERE r.id=reversal_id));
CREATE INDEX sale_reversal_items_reversal ON public.sale_reversal_items(reversal_id);

ALTER TABLE public.sale_items DROP CONSTRAINT sale_items_item_id_key;
CREATE INDEX sale_items_item_history ON public.sale_items(item_id,sale_id);

CREATE OR REPLACE FUNCTION public.internal_record_payment(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.loans;balance numeric;a numeric;rid uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Staff login required';END IF;
 SELECT * INTO l FROM public.loans WHERE id=(p->>'loan_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found';END IF;
 IF l.status='Cancelled' THEN RAISE EXCEPTION 'Cancelled loans cannot receive repayments';END IF;
 SELECT l.amount-coalesce((SELECT sum(r.loan_reduction) FROM public.sale_reversals r WHERE r.sale_id=l.sale_id),0)-coalesce((SELECT sum(amount) FROM public.loan_payments WHERE loan_id=l.id),0) INTO balance;
 a:=round((p->>'amount')::numeric,2);
 IF a IS NULL OR a<=0 OR a>balance THEN RAISE EXCEPTION 'Payment must be positive and not exceed the remaining balance';END IF;
 IF p->>'method' NOT IN('Cash','Card','Bank Transfer','Mixed','Cheque') THEN RAISE EXCEPTION 'Invalid method';END IF;
 INSERT INTO public.loan_payments(loan_id,amount,method,received_by) VALUES(l.id,a,p->>'method',auth.uid()) RETURNING id INTO rid;
 IF a=balance THEN UPDATE public.loans SET status='Closed' WHERE id=l.id;ELSE UPDATE public.loans SET status='Active' WHERE id=l.id;END IF;
 RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.adjust_loan_terms(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.loans;paid numeric;refunded numeric;schedulePaid numeric;reduction numeric;remaining numeric;n integer:=(p->>'installments')::integer;f text:=p->>'frequency';firstdate date:=(p->>'first_due')::date;due date;base numeric;k integer;plan jsonb:='[]';rid uuid;today date:=(now() AT TIME ZONE 'Asia/Colombo')::date;
BEGIN
 SELECT * INTO l FROM public.loans WHERE id=(p->>'loan_id')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT public.staff_can('Manage loan terms',l.branch_id) THEN RAISE EXCEPTION 'Loan term management permission required';END IF;
 IF l.status='Cancelled' THEN RAISE EXCEPTION 'Cancelled loans cannot be rescheduled';END IF;
 IF n IS NULL OR n<1 OR n>120 OR firstdate IS NULL OR firstdate<today OR f IS NULL OR f NOT IN('Monthly','Every 2 weeks','Weekly') THEN RAISE EXCEPTION 'Choose 1–120 installments, a valid frequency and a due date from today';END IF;
 SELECT coalesce(sum(amount),0) INTO paid FROM public.loan_payments WHERE loan_id=l.id;
 SELECT coalesce(sum(payment_refund),0),coalesce(sum(loan_reduction),0) INTO refunded,reduction FROM public.sale_reversals WHERE sale_id=l.sale_id;
 schedulePaid:=paid-refunded;remaining:=l.amount-reduction-paid;
 IF remaining<=0 THEN RAISE EXCEPTION 'Closed loans cannot be rescheduled';END IF;
 IF schedulePaid>0 THEN plan:=jsonb_build_array(jsonb_build_object('installment_no',0,'due_date',today,'amount',schedulePaid));END IF;
 base:=floor(remaining*100/n)/100;IF base<=0 THEN RAISE EXCEPTION 'Too many installments for the remaining balance';END IF;
 FOR k IN 1..n LOOP
  IF f='Monthly' THEN due:=(date_trunc('month',firstdate)+(k-1)*interval '1 month')::date;due:=due+least(extract(day from firstdate)::int,extract(day from (due+interval '1 month - 1 day'))::int)-1;ELSE due:=firstdate+(k-1)*CASE WHEN f='Weekly' THEN 7 ELSE 14 END;END IF;
  plan:=plan||jsonb_build_array(jsonb_build_object('installment_no',k,'due_date',due,'amount',CASE WHEN k=n THEN remaining-base*(n-1) ELSE base END));
 END LOOP;
 INSERT INTO public.loan_term_revisions(loan_id,frequency,installment_count,first_due,paid_at_revision,schedule,created_by) VALUES(l.id,f,n,firstdate,schedulePaid,plan,auth.uid()) RETURNING id INTO rid;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),l.branch_id,'Loans','Rescheduled','Changed terms for '||l.loan_no||' to '||n||' installments, '||f||', starting '||firstdate,rid::text);
 RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_sale(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid:=(p->>'sale_id')::uuid;s public.sales;l public.loans;kind text:=p->>'kind';reason text:=trim(coalesce(p->>'reason',''));method text:=coalesce(p->>'refund_method','No refund');existing uuid;rid uuid;line record;line_count integer;total numeric;calc numeric;prevPaid numeric;prevCredit numeric;prevLoan numeric;prevPaymentRefund numeric;paid numeric;paidReduction numeric;creditReduction numeric;loanReduction numeric;paymentRefund numeric;refund numeric;outstanding numeric;newOutstanding numeric;effectivePaid numeric;plan jsonb;duePlan jsonb;base numeric;due date;firstdate date;n integer;k integer;moved integer;
BEGIN
 SELECT * INTO s FROM public.sales WHERE id=sid FOR UPDATE;
 IF NOT FOUND OR NOT public.staff_can('Manage settings',s.branch_id) THEN RAISE EXCEPTION 'Owner permission required for this branch';END IF;
 existing:=public.operation_begin(p,'sale-reversal');IF existing IS NOT NULL THEN RETURN existing;END IF;
 IF kind NOT IN('Void','Return') OR length(reason)<3 OR length(reason)>500 THEN RAISE EXCEPTION 'Enter a return or void reason between 3 and 500 characters';END IF;
 IF kind='Void' AND EXISTS(SELECT 1 FROM public.sale_reversals WHERE sale_id=sid) THEN RAISE EXCEPTION 'This bill already has return or void history. Keep its history or return any remaining pieces';END IF;
 IF kind='Return' AND EXISTS(SELECT 1 FROM public.sale_reversals WHERE sale_id=sid AND kind='Void') THEN RAISE EXCEPTION 'This bill is already voided';END IF;
 IF kind='Return' AND (p->'line_ids' IS NULL OR jsonb_typeof(p->'line_ids')<>'array' OR jsonb_array_length(p->'line_ids')<1) THEN RAISE EXCEPTION 'Select at least one piece to return';END IF;
 IF kind='Return' AND (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p->'line_ids'))<>jsonb_array_length(p->'line_ids') THEN RAISE EXCEPTION 'A piece can only be selected once';END IF;
 SELECT count(*),coalesce(sum(final_price),0),coalesce(sum(calculated_price),0) INTO line_count,total,calc FROM public.sale_items si WHERE si.sale_id=sid AND (kind='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids')));
 IF line_count=0 OR (kind='Return' AND line_count<>jsonb_array_length(p->'line_ids')) THEN RAISE EXCEPTION 'Selected pieces do not belong to this bill';END IF;
 IF kind='Void' AND line_count<>(SELECT count(*) FROM public.sale_items WHERE sale_id=sid) THEN RAISE EXCEPTION 'All bill pieces must be included in a void';END IF;
 PERFORM 1 FROM public.items WHERE id IN(SELECT item_id FROM public.sale_items si WHERE si.sale_id=sid AND (kind='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids')))) ORDER BY id FOR UPDATE;
 FOR line IN SELECT si.id AS sale_item_id,i.id AS item_id,i.status,i.sold_invoice FROM public.sale_items si JOIN public.items i ON i.id=si.item_id WHERE si.sale_id=sid AND (kind='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids'))) LOOP
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
 INSERT INTO public.sale_reversals(sale_id,branch_id,kind,reason,refund_method,total_amount,paid_reduction,credit_reduction,loan_reduction,payment_refund,refund_amount,created_by) VALUES(sid,s.branch_id,kind,reason,method,total,paidReduction,creditReduction,loanReduction,paymentRefund,refund,auth.uid()) RETURNING id INTO rid;
 INSERT INTO public.sale_reversal_items(reversal_id,sale_item_id,item_id,amount,calculated_amount,purchase_cost) SELECT rid,si.id,si.item_id,si.final_price,si.calculated_price,coalesce(sc.purchase_cost,0) FROM public.sale_items si LEFT JOIN public.sale_costs sc ON sc.sale_item_id=si.id WHERE si.sale_id=sid AND (kind='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids')));
 UPDATE public.items SET status='In Stock',sold_invoice=NULL WHERE id IN(SELECT item_id FROM public.sale_items si WHERE si.sale_id=sid AND (kind='Void' OR si.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p->'line_ids')))) AND status='Sold' AND sold_invoice=s.invoice_no;
 GET DIAGNOSTICS moved=ROW_COUNT;IF moved<>line_count THEN RAISE EXCEPTION 'Stock changed during the return; nothing was saved';END IF;
 IF l.id IS NOT NULL THEN
  newOutstanding:=greatest(l.amount-prevLoan-loanReduction-paid,0);
  IF kind='Void' THEN UPDATE public.loans SET status='Cancelled' WHERE id=l.id;
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
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),s.branch_id,'Sales',kind,CASE WHEN kind='Void' THEN 'Voided bill ' ELSE 'Returned pieces on ' END||s.invoice_no||' · value '||total||' · refund '||refund||' · '||reason,sid::text);
 PERFORM public.operation_finish(p,'sale-reversal',rid);RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.reverse_sale(jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.reverse_sale(jsonb) TO authenticated;

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
 DELETE FROM public.sale_costs WHERE sale_item_id IN(SELECT id FROM public.sale_items WHERE sale_id=sid);
 DELETE FROM public.sale_items WHERE sale_id=sid;
 DELETE FROM public.sales WHERE id=sid;
 INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),s.branch_id,'Sales','Deleted','Deleted standalone bill '||s.invoice_no||' · original total '||s.final_total||' · no loan, cheque, return or repayment history',sid::text);
END $$;
REVOKE ALL ON FUNCTION public.delete_sale(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.delete_sale(uuid) TO authenticated;

COMMENT ON TABLE public.sale_reversals IS 'Append-only void and return headers preserving original invoices, loan reductions and refund history.';
COMMENT ON TABLE public.sale_reversal_items IS 'Append-only returned pieces and their original value and cost snapshots.';
COMMENT ON FUNCTION public.delete_sale(uuid) IS 'Deletes only standalone sales with no loan, cheque, return, repayment or later stock dependency; otherwise returns an actionable error.';