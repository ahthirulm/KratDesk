CREATE TABLE public.backup_schedule (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  every_days int NOT NULL DEFAULT 2 CHECK (every_days BETWEEN 1 AND 30),
  run_hour int NOT NULL DEFAULT 2 CHECK (run_hour BETWEEN 0 AND 23),
  recipients text[] NOT NULL DEFAULT '{}',
  from_name text NOT NULL DEFAULT 'KaratDesk Backup',
  from_email text NOT NULL DEFAULT '',
  email_domain text NOT NULL DEFAULT '',
  resend_domain_id text,
  domain_status text NOT NULL DEFAULT 'not added',
  api_key text NOT NULL DEFAULT '',
  encrypt boolean NOT NULL DEFAULT true,
  encrypt_password text NOT NULL DEFAULT '',
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.backup_schedule TO authenticated;
GRANT ALL ON public.backup_schedule TO service_role;
ALTER TABLE public.backup_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads backup schedule" ON public.backup_schedule FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner adds backup schedule" ON public.backup_schedule FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner edits backup schedule" ON public.backup_schedule FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  trigger text NOT NULL DEFAULT 'schedule',
  status text NOT NULL,
  records int NOT NULL DEFAULT 0,
  size_bytes int NOT NULL DEFAULT 0,
  recipients text[] NOT NULL DEFAULT '{}',
  error text
);
GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads backup runs" ON public.backup_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));