CREATE OR REPLACE FUNCTION public.complete_owner_setup(p_user_id uuid, p_shop_name text, p_owner_name text, p_username text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    ON CONFLICT(user_id) DO UPDATE SET role='admin';
  INSERT INTO public.settings(id,shop_name,inactivity_minutes) VALUES(true,coalesce(nullif(trim(p_shop_name),''),'KaratDesk'),60)
    ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.metal_types(name) VALUES('22K Gold'),('24K Gold'),('18K Gold'),('Silver') ON CONFLICT DO NOTHING;
  INSERT INTO public.audit_events(actor_id,actor_name,branch_id,category,action,description,record_id)
    VALUES(p_user_id,trim(p_owner_name),NULL,'Security','Initialised','Created the first super administrator',p_user_id::text);
END;
$function$;