DO $do$ DECLARE body text; f oid; BEGIN
FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='factory_reset' LOOP
SELECT pg_get_functiondef(f) INTO body;
body := regexp_replace(body, '(delete from public\.(job_types|suppliers|stock_categories|daily_rates|staff_roles))\s*;', '\1 where true;', 'gi');
EXECUTE body;
END LOOP;
END $do$;