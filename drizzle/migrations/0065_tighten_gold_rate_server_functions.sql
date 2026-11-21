REVOKE EXECUTE ON FUNCTION public.kd_apply_gold_rates() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.kd_audit_rate_change() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.kd_audit_rate_change() TO service_role;
CREATE INDEX IF NOT EXISTS kd_rate_history_metal_id_idx ON public.kd_rate_history(metal_id);