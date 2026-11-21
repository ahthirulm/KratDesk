DO $do$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('public.kd_restore_records(jsonb)'::regprocedure) INTO body;
body := replace(body, $q$format('DELETE FROM public.%I',t)$q$, $q$format('DELETE FROM public.%I WHERE true',t)$q$);
IF position('WHERE true' in body)=0 THEN RAISE EXCEPTION 'restore clear statement not found'; END IF;
EXECUTE body;
END $do$;