DO $migration$
DECLARE definition text;
BEGIN
SELECT pg_get_functiondef('public.complete_sale(jsonb)'::regprocedure) INTO definition;
IF position('select rate_per_gram into rate from public.daily_rates where date=today and metal_id=r.metal_id;' in definition)=0 THEN RAISE EXCEPTION 'Expected daily rate lookup not found'; END IF;
definition := replace(definition, 'select rate_per_gram into rate from public.daily_rates where date=today and metal_id=r.metal_id;', 'rate:=round((j->>''rate_used'')::numeric,2);');
definition := replace(definition, 'if rate is null then raise exception ''Today’s metal rate is missing''; end if;', 'if rate is null or rate<=0 or rate::text in (''NaN'',''Infinity'',''-Infinity'') then raise exception ''Enter a positive price per gram for every piece''; end if;');
EXECUTE definition;
END $migration$;
COMMENT ON FUNCTION public.complete_sale(jsonb) IS 'Transactional sale using billing-entered rate_used per piece; validates positive rates, locks stock and snapshots weight multiplied by rate.';