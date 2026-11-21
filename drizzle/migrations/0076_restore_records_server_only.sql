DO $mig$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.kd_restore_records(jsonb)'::regprocedure);
  def := replace(def, 'public.kd_restore_records(p_plans jsonb)', 'public.kd_restore_records(p_plans jsonb, p_actor uuid)');
  IF position($f$public.has_role(auth.uid(),'admin')$f$ in def)=0 THEN RAISE EXCEPTION 'owner check not found'; END IF;
  def := replace(def, $f$public.has_role(auth.uid(),'admin')$f$, $f$(p_actor IS NOT NULL AND public.has_role(p_actor,'admin'))$f$);
  IF position($f$PERFORM set_config('app.kd_restoring','1',true);$f$ in def)=0 THEN RAISE EXCEPTION 'restoring flag not found'; END IF;
  def := replace(def, $f$PERFORM set_config('app.kd_restoring','1',true);$f$,
    $f$PERFORM set_config('request.jwt.claim.sub',p_actor::text,true); PERFORM set_config('request.jwt.claims',json_build_object('sub',p_actor,'role','authenticated')::text,true); PERFORM set_config('app.kd_restoring','1',true);$f$);
  EXECUTE def;
END $mig$;
DROP FUNCTION public.kd_restore_records(jsonb);
REVOKE EXECUTE ON FUNCTION public.kd_restore_records(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kd_restore_records(jsonb, uuid) TO service_role;