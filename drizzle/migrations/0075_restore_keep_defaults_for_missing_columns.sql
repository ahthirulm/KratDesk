DO $mig$
DECLARE def text; old_frag text := $f$AND a.attgenerated='';$f$; new_frag text := $f$AND a.attgenerated='' AND a.attname IN (SELECT DISTINCT jsonb_object_keys(r) FROM jsonb_array_elements(plan->'rows') r);$f$;
BEGIN
  def := pg_get_functiondef('public.kd_restore_records(jsonb)'::regprocedure);
  IF position(new_frag in def) > 0 THEN RETURN; END IF;
  IF position(old_frag in def) = 0 THEN RAISE EXCEPTION 'kd_restore_records column list not found'; END IF;
  EXECUTE replace(def, old_frag, new_frag);
END $mig$;