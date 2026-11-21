CREATE TABLE IF NOT EXISTS public.kd_gold_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id=1), enabled boolean NOT NULL DEFAULT false,
 prices jsonb, source_date date, last_fetch timestamptz, last_success timestamptz,
 last_error text, lease_until timestamptz
);
REVOKE ALL ON public.kd_gold_settings FROM anon, authenticated;
GRANT ALL ON public.kd_gold_settings TO service_role;
ALTER TABLE public.kd_gold_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.kd_gold_settings(id) VALUES(1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.kd_gold_fetch_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, fetched_at timestamptz NOT NULL DEFAULT now(),
 source_date date NOT NULL, prices jsonb NOT NULL
);
REVOKE ALL ON public.kd_gold_fetch_history FROM anon, authenticated;
GRANT ALL ON public.kd_gold_fetch_history TO service_role;
ALTER TABLE public.kd_gold_fetch_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.kd_rate_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, changed_at timestamptz NOT NULL DEFAULT now(),
 rate_date date NOT NULL, metal_id uuid NOT NULL REFERENCES public.metal_types(id),
 old_pawn numeric, new_pawn numeric NOT NULL, source text NOT NULL, applied_by uuid, source_date date
);
REVOKE ALL ON public.kd_rate_history FROM anon, authenticated;
GRANT ALL ON public.kd_rate_history TO service_role;
ALTER TABLE public.kd_rate_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.kd_account_contacts (
 user_id uuid PRIMARY KEY, email text NOT NULL, verified_at timestamptz, invited_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.kd_account_contacts FROM anon, authenticated;
GRANT ALL ON public.kd_account_contacts TO service_role;
ALTER TABLE public.kd_account_contacts ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS kd_account_contacts_email_key ON public.kd_account_contacts(lower(email));

CREATE TABLE IF NOT EXISTS public.kd_account_links (
 user_id uuid PRIMARY KEY, email text NOT NULL, token_digest text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, used boolean NOT NULL DEFAULT false
);
REVOKE ALL ON public.kd_account_links FROM anon, authenticated;
GRANT ALL ON public.kd_account_links TO service_role;
ALTER TABLE public.kd_account_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.kd_request_limits (
 key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL
);
REVOKE ALL ON public.kd_request_limits FROM anon, authenticated;
GRANT ALL ON public.kd_request_limits TO service_role;
ALTER TABLE public.kd_request_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.kd_take_limit(p_key text,p_limit integer,p_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_count integer;
BEGIN
 DELETE FROM kd_request_limits WHERE expires_at<now();
 INSERT INTO kd_request_limits(key,count,expires_at) VALUES(p_key,1,now()+make_interval(secs=>p_seconds))
 ON CONFLICT(key) DO UPDATE SET count=kd_request_limits.count+1 RETURNING count INTO current_count;
 RETURN current_count<=p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.kd_take_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kd_take_limit(text,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.kd_preview_system_tag()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE next_number bigint;
BEGIN
 IF NOT coalesce(public.staff_can('Manage stock'),false) THEN RAISE EXCEPTION 'Stock management access required'; END IF;
 SELECT CASE WHEN is_called THEN last_value+1 ELSE last_value END INTO next_number FROM public.system_tag_seq;
 RETURN 'KD'||lpad(next_number::text,6,'0');
END;
$$;
REVOKE ALL ON FUNCTION public.kd_preview_system_tag() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kd_preview_system_tag() TO authenticated;

CREATE OR REPLACE FUNCTION public.kd_rename_item_tag(p_id uuid,p_tag text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target_branch text;
BEGIN
 IF NOT coalesce(public.staff_can('Manage stock'),false) THEN RAISE EXCEPTION 'Stock management access required'; END IF;
 IF length(trim(p_tag))<1 OR length(p_tag)>120 THEN RAISE EXCEPTION 'Enter an internal tag up to 120 characters'; END IF;
 SELECT branch_id INTO target_branch FROM items WHERE id=p_id FOR UPDATE;
 IF target_branch IS NULL OR NOT coalesce(public.staff_can('Manage stock',target_branch),false) THEN RAISE EXCEPTION 'Stock not found or branch access required'; END IF;
 IF EXISTS(SELECT 1 FROM items WHERE id<>p_id AND branch_id=target_branch AND lower(tag_id)=lower(trim(p_tag))) THEN RAISE EXCEPTION 'That internal tag is already used in this branch'; END IF;
 UPDATE items SET tag_id=trim(p_tag) WHERE id=p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.kd_rename_item_tag(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kd_rename_item_tag(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.kd_audit_rate_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND (TG_OP='INSERT' OR OLD.rate_per_gram IS DISTINCT FROM NEW.rate_per_gram) THEN
  INSERT INTO kd_rate_history(rate_date,metal_id,old_pawn,new_pawn,source,applied_by)
  VALUES(NEW.date,NEW.metal_id,CASE WHEN TG_OP='UPDATE' THEN OLD.rate_per_gram*8 END,NEW.rate_per_gram*8,'Manual',auth.uid());
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.kd_audit_rate_change() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kd_audit_rate_change() TO authenticated;
DROP TRIGGER IF EXISTS kd_rate_history ON public.daily_rates;
CREATE TRIGGER kd_rate_history AFTER INSERT OR UPDATE ON public.daily_rates FOR EACH ROW EXECUTE FUNCTION public.kd_audit_rate_change();

CREATE OR REPLACE FUNCTION public.kd_apply_gold_rates()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg kd_gold_settings; metal record; amount numeric;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT * INTO cfg FROM kd_gold_settings WHERE id=1 FOR UPDATE;
 IF cfg.prices IS NULL OR cfg.source_date IS NULL THEN RETURN false; END IF;
 FOR metal IN SELECT id,name FROM metal_types LOOP
  amount=(cfg.prices->>(regexp_replace(upper(metal.name),'[^0-9]*([0-9]+)K.*','\1')||'K'))::numeric;
  IF amount IS NULL THEN
   IF metal.name ILIKE '18K%' AND cfg.prices->>'24K' IS NOT NULL THEN amount=(cfg.prices->>'24K')::numeric*18/24; END IF;
   IF metal.name ILIKE '21K%' AND cfg.prices->>'24K' IS NOT NULL THEN amount=(cfg.prices->>'24K')::numeric*21/24; END IF;
  END IF;
  IF amount IS NOT NULL AND amount>0 AND metal.name ILIKE '%gold%' THEN
   INSERT INTO daily_rates(date,metal_id,rate_per_gram) VALUES(cfg.source_date,metal.id,amount/8)
   ON CONFLICT(date,metal_id) DO UPDATE SET rate_per_gram=EXCLUDED.rate_per_gram WHERE daily_rates.rate_per_gram IS DISTINCT FROM EXCLUDED.rate_per_gram;
   INSERT INTO kd_rate_history(rate_date,metal_id,old_pawn,new_pawn,source,applied_by,source_date)
   SELECT cfg.source_date,metal.id,old.rate_per_gram*8,amount,cfg.prices->>'provider',auth.uid(),cfg.source_date
   FROM (SELECT rate_per_gram FROM daily_rates WHERE date=cfg.source_date AND metal_id=metal.id) old
   WHERE old.rate_per_gram*8 IS DISTINCT FROM amount ON CONFLICT DO NOTHING;
   IF NOT FOUND THEN
    INSERT INTO kd_rate_history(rate_date,metal_id,old_pawn,new_pawn,source,applied_by,source_date)
    SELECT cfg.source_date,metal.id,NULL,amount,cfg.prices->>'provider',auth.uid(),cfg.source_date
    WHERE NOT EXISTS(SELECT 1 FROM kd_rate_history WHERE rate_date=cfg.source_date AND metal_id=metal.id AND new_pawn=amount);
   END IF;
  END IF;
 END LOOP;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.kd_apply_gold_rates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kd_apply_gold_rates() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kd_store_gold_quote(p_prices jsonb,p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg kd_gold_settings; changed boolean;
BEGIN
 SELECT * INTO cfg FROM kd_gold_settings WHERE id=1 FOR UPDATE;
 IF NOT cfg.enabled THEN UPDATE kd_gold_settings SET lease_until=NULL WHERE id=1; RETURN; END IF;
 changed=cfg.prices IS DISTINCT FROM p_prices OR cfg.source_date IS DISTINCT FROM p_date;
 INSERT INTO kd_gold_fetch_history(source_date,prices) SELECT p_date,p_prices WHERE changed OR NOT EXISTS(SELECT 1 FROM kd_gold_fetch_history);
 UPDATE kd_gold_settings SET prices=p_prices,source_date=p_date,last_success=now(),last_error=NULL,lease_until=NULL WHERE id=1;
 IF changed OR NOT EXISTS(SELECT 1 FROM daily_rates WHERE date=p_date AND metal_id IN(SELECT id FROM metal_types WHERE name ILIKE '%gold%')) THEN PERFORM public.kd_apply_gold_rates(); END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.kd_store_gold_quote(jsonb,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kd_store_gold_quote(jsonb,date) TO service_role;

CREATE OR REPLACE FUNCTION public.kd_refresh_gold_rates()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE kd_gold_settings SET lease_until=now()+interval '4 minutes',last_fetch=now() WHERE id=1 AND enabled AND (lease_until IS NULL OR lease_until<now()) RETURNING true;
$$;
REVOKE ALL ON FUNCTION public.kd_refresh_gold_rates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kd_refresh_gold_rates() TO service_role;

CREATE OR REPLACE FUNCTION public.kd_gold_fetch_failed(p_message text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE kd_gold_settings SET last_error=left(p_message,500),lease_until=NULL WHERE id=1;
$$;
REVOKE ALL ON FUNCTION public.kd_gold_fetch_failed(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kd_gold_fetch_failed(text) TO service_role;