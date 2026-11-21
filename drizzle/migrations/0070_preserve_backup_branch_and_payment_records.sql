DO $$ DECLARE r record; body text; BEGIN
FOR r IN SELECT oid,prosrc FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('branch_transaction_guard','capture_shop_audit','capture_sale_split','capture_cheque_payment','capture_billing_unit','audit_fx_entry','audit_old_gold','audit_old_gold_transfer','kd_audit_rate_change') LOOP
body:=pg_get_functiondef(r.oid);
body:=regexp_replace(body,'\mBEGIN\M','BEGIN IF current_setting(''app.kd_restoring'',true) = ''1'' AND public.has_role(auth.uid(),''admin'') THEN IF TG_OP = ''DELETE'' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;','i');
EXECUTE body;
END LOOP;
SELECT pg_get_functiondef(oid) INTO body FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='kd_restore_records';
body:=replace(body,'PERFORM pg_advisory_xact_lock(882234);','PERFORM pg_advisory_xact_lock(882234); PERFORM set_config(''app.kd_restoring'',''1'',true);');
body:=replace(body,'PERFORM public.sync_shop_sequences();','PERFORM public.sync_shop_sequences(); PERFORM set_config(''app.kd_restoring'',''0'',true);');
EXECUTE body;
END $$;