DO $mig$
DECLARE def text; claims_old text := $f$PERFORM set_config('request.jwt.claim.sub',p_actor::text,true); PERFORM set_config('request.jwt.claims',json_build_object('sub',p_actor,'role','authenticated')::text,true); $f$;
BEGIN
  def := pg_get_functiondef('public.kd_restore_records(jsonb,uuid)'::regprocedure);
  IF position(claims_old in def)=0 THEN RAISE EXCEPTION 'claims block not found'; END IF;
  def := replace(def, claims_old, '');
  def := replace(def, 'public.kd_restore_records(p_plans jsonb, p_actor uuid)', 'public.kd_restore_records(p_plans jsonb, p_actor uuid, p_aal text)');
  def := replace(def, $f$BEGIN
 IF NOT $f$, $f$BEGIN
 PERFORM set_config('request.jwt.claim.sub',coalesce(p_actor::text,''),true); PERFORM set_config('request.jwt.claims',json_build_object('sub',p_actor,'role','authenticated','aal',coalesce(p_aal,'aal1'))::text,true);
 IF NOT $f$);
  IF position('request.jwt.claims' in def)=0 THEN RAISE EXCEPTION 'body start not found'; END IF;
  EXECUTE def;
END $mig$;
DROP FUNCTION public.kd_restore_records(jsonb, uuid);
REVOKE EXECUTE ON FUNCTION public.kd_restore_records(jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kd_restore_records(jsonb, uuid, text) TO service_role;