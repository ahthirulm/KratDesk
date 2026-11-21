ALTER TABLE public.profiles ADD COLUMN username text;
ALTER TABLE public.profiles ADD COLUMN mfa_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN two_factor_required boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX profiles_username_lower_unique ON public.profiles (lower(username)) WHERE username IS NOT NULL;
ALTER TABLE public.settings ADD COLUMN inactivity_minutes integer NOT NULL DEFAULT 60;
ALTER TABLE public.settings ADD CONSTRAINT settings_inactivity_minutes_check CHECK (inactivity_minutes BETWEEN 5 AND 480);

CREATE OR REPLACE FUNCTION public.new_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles(id,display_name,username)
  VALUES(NEW.id,coalesce(nullif(trim(NEW.raw_user_meta_data->>'display_name'),''),'Staff'),nullif(lower(trim(NEW.raw_user_meta_data->>'username')),''));
  INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'cashier');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN coalesce((SELECT mfa_enabled FROM public.profiles WHERE id=auth.uid()),false)
      THEN coalesce(auth.jwt()->>'aal','')='aal2'
    WHEN coalesce((SELECT two_factor_required FROM public.profiles WHERE id=auth.uid()),false)
      THEN false
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mfa_satisfied() AND EXISTS(
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_can(permission text, target_branch text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.mfa_satisfied()
    AND (target_branch IS NULL OR EXISTS(SELECT 1 FROM public.branches WHERE id=target_branch AND active))
    AND (
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin')
      OR EXISTS(
        SELECT 1 FROM public.staff_access a
        JOIN public.staff_roles r ON r.id=a.role_id
        WHERE a.user_id=auth.uid() AND a.active AND permission=ANY(r.permissions)
          AND (target_branch IS NULL OR target_branch=ANY(a.branch_ids))
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.login_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin')
    OR EXISTS(SELECT 1 FROM public.staff_access WHERE user_id=auth.uid() AND active)
  );
$$;

CREATE OR REPLACE FUNCTION public.shop_public_details()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.login_access() OR NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'Active staff access required';
  END IF;
  RETURN coalesce(
    (SELECT to_jsonb(s) FROM public.settings s LIMIT 1),
    '{"shop_name":"Jewellery POS","address":"","phone":"","currency":"LKR","pricing_unit":"Pound (8g)","inactivity_minutes":60}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_owner_setup(p_user_id uuid,p_shop_name text,p_owner_name text,p_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE clean_username text:=lower(trim(p_username));
BEGIN
  PERFORM pg_advisory_xact_lock(882233);
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') THEN
    RAISE EXCEPTION 'An owner is already configured';
  END IF;
  IF clean_username IS NULL OR clean_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' OR nullif(trim(p_owner_name),'') IS NULL THEN
    RAISE EXCEPTION 'Valid owner name and username required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN
    RAISE EXCEPTION 'Owner account not found';
  END IF;
  UPDATE public.profiles SET display_name=trim(p_owner_name),username=clean_username WHERE id=p_user_id;
  INSERT INTO public.user_roles(user_id,role) VALUES(p_user_id,'admin')
    ON CONFLICT(user_id,role) DO UPDATE SET role='admin';
  INSERT INTO public.settings(id,shop_name,inactivity_minutes) VALUES(true,nullif(trim(p_shop_name),'')||'','60')
    ON CONFLICT(id) DO UPDATE SET shop_name=coalesce(nullif(trim(p_shop_name),''),public.settings.shop_name);
  INSERT INTO public.metal_types(name) VALUES('22K Gold'),('24K Gold'),('18K Gold'),('Silver') ON CONFLICT DO NOTHING;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id)
    VALUES(p_user_id,trim(p_owner_name),NULL,'Security','Initialised','Created the first super administrator and completed shop setup',p_user_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_mfa(enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE currently_required boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT two_factor_required INTO currently_required FROM public.profiles WHERE id=auth.uid();
  IF coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'Two-factor verification required'; END IF;
  IF NOT enabled AND currently_required THEN RAISE EXCEPTION 'Your administrator requires two-factor authentication'; END IF;
  UPDATE public.profiles SET mfa_enabled=enabled WHERE id=auth.uid();
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id)
    VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),NULL,'Security',CASE WHEN enabled THEN '2FA enabled' ELSE '2FA disabled' END,CASE WHEN enabled THEN 'Enabled authenticator-app verification' ELSE 'Disabled authenticator-app verification' END,auth.uid()::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_staff_two_factor(p_user_id uuid,p_required boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Owner access required'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user_id AND role='admin') THEN
    RAISE EXCEPTION 'Manage owner 2FA from the owner profile';
  END IF;
  UPDATE public.profiles SET two_factor_required=p_required,mfa_enabled=CASE WHEN p_required THEN mfa_enabled ELSE false END WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff account not found'; END IF;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id)
    VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),NULL,'Security',CASE WHEN p_required THEN '2FA requested' ELSE '2FA optional' END,CASE WHEN p_required THEN 'Requested authenticator-app verification for ' ELSE 'Made two-factor authentication optional for ' END||coalesce((SELECT display_name FROM public.profiles WHERE id=p_user_id),'staff member'),p_user_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_security_action(p_user_id uuid,p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Owner access required'; END IF;
  IF p_action NOT IN('Password reset','Staff account created') THEN RAISE EXCEPTION 'Invalid security action'; END IF;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id)
    VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Staff'),NULL,'Security',p_action,p_action||' for '||coalesce((SELECT display_name FROM public.profiles WHERE id=p_user_id),'staff member'),p_user_id::text);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_owner() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_owner_setup(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_owner_setup(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.login_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_profile_mfa(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_two_factor(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_action(uuid,text) TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE(display_name,phone,avatar_path) ON public.profiles TO authenticated;

DROP POLICY rates_read ON public.daily_rates;
CREATE POLICY rates_read ON public.daily_rates FOR SELECT TO authenticated
  USING(public.staff_can('View stock') OR public.staff_can('Manage stock'));
DROP POLICY metals_read ON public.metal_types;
CREATE POLICY metals_read ON public.metal_types FOR SELECT TO authenticated
  USING(public.staff_can('View stock') OR public.staff_can('Manage stock'));
