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
  'audit_by_day', (SELECT coalesce(jsonb_agg(jsonb_build_object('day',d,'events',n) ORDER BY d),'[]') FROM (SELECT (created_at AT TIME ZONE 'Asia/Colombo')::date d,count(*) n FROM public.audit_events WHERE created_at>now()-interval '14 days' GROUP BY 1) w)
 ) INTO r;
 RETURN r;
END $$;