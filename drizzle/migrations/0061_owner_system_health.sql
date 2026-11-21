CREATE TABLE public.app_errors(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 source text NOT NULL DEFAULT 'browser',
 message text NOT NULL,
 detail text NOT NULL DEFAULT '',
 url text NOT NULL DEFAULT '',
 user_agent text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT app_errors_len CHECK (length(message)<=1000 AND length(detail)<=8000 AND length(url)<=1000 AND length(user_agent)<=500)
);
GRANT SELECT, INSERT ON public.app_errors TO authenticated;
GRANT ALL ON public.app_errors TO service_role;
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff log own errors" ON public.app_errors FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner reads errors" ON public.app_errors FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX app_errors_created_idx ON public.app_errors(created_at DESC);

CREATE OR REPLACE FUNCTION public.system_health() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 SELECT jsonb_build_object(
  'checked_at', now(),
  'postgres_version', current_setting('server_version'),
  'db_size_bytes', pg_database_size(current_database()),
  'started_at', pg_postmaster_start_time(),
  'connections', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()),
  'active_queries', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active'),
  'max_connections', current_setting('max_connections')::int,
  'cache_hit_pct', (SELECT round(100.0*sum(blks_hit)/nullif(sum(blks_hit)+sum(blks_read),0),2) FROM pg_stat_database WHERE datname=current_database()),
  'deadlocks', (SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()),
  'rollbacks', (SELECT xact_rollback FROM pg_stat_database WHERE datname=current_database()),
  'commits', (SELECT xact_commit FROM pg_stat_database WHERE datname=current_database()),
  'tables', (SELECT coalesce(jsonb_agg(t ORDER BY (t->>'bytes')::bigint DESC),'[]') FROM (SELECT jsonb_build_object('name',relname,'rows',n_live_tup,'bytes',pg_total_relation_size(relid),'dead_rows',n_dead_tup,'last_vacuum',greatest(last_vacuum,last_autovacuum)) t FROM pg_stat_user_tables WHERE schemaname='public') x),
  'storage', (SELECT coalesce(jsonb_agg(s),'[]') FROM (SELECT jsonb_build_object('bucket',bucket_id,'files',count(*),'bytes',coalesce(sum((metadata->>'size')::bigint),0),'last_upload',max(created_at)) s FROM storage.objects GROUP BY bucket_id) y),
  'recent_uploads', (SELECT coalesce(jsonb_agg(u),'[]') FROM (SELECT jsonb_build_object('bucket',bucket_id,'name',name,'bytes',(metadata->>'size')::bigint,'type',metadata->>'mimetype','created_at',created_at) u FROM storage.objects ORDER BY created_at DESC LIMIT 25) z),
  'errors_24h', (SELECT count(*) FROM public.app_errors WHERE created_at>now()-interval '24 hours'),
  'audit_24h', (SELECT count(*) FROM public.audit_events WHERE created_at>now()-interval '24 hours'),
  'audit_by_day', (SELECT coalesce(jsonb_agg(d ORDER BY d->>'day'),'[]') FROM (SELECT jsonb_build_object('day',(created_at AT TIME ZONE 'Asia/Colombo')::date,'events',count(*)) d FROM public.audit_events WHERE created_at>now()-interval '14 days' GROUP BY 1) w)
 ) INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.system_health() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.system_health() TO authenticated;