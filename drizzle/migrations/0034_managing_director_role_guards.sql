CREATE OR REPLACE FUNCTION public.save_staff_role(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());perms text[];existingName text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Owner access required';END IF;
 SELECT name INTO existingName FROM public.staff_roles WHERE id=rid;
 IF existingName='Managing Director' OR lower(trim(coalesce(p->>'name','')))='managing director' THEN RAISE EXCEPTION 'Managing Director is a protected built-in role';END IF;
 IF nullif(trim(p->>'name'),'') IS NULL OR lower(trim(p->>'name'))='super admin' THEN RAISE EXCEPTION 'Choose a valid custom role name';END IF;
 SELECT coalesce(array_agg(value),'{}') INTO perms FROM jsonb_array_elements_text(p->'permissions');
 IF NOT perms <@ ARRAY['View dashboard','Create bills','View stock','Manage stock','Collect repayments','View customers','View costs and profit','View reports','Manage suppliers','Manage categories','Manage users','Manage roles','Manage settings','Transfer stock','Manage expenses','Manage loan terms','Manage currency exchange','View currency reports']::text[] THEN RAISE EXCEPTION 'Unknown permission';END IF;
 INSERT INTO public.staff_roles(id,name,permissions) VALUES(rid,trim(p->>'name'),perms) ON CONFLICT(id) DO UPDATE SET name=excluded.name,permissions=excluded.permissions;RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.save_staff_access(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=(p->>'user_id')::uuid;bs text[];roleName text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Owner access required';END IF;
 IF uid=auth.uid() OR public.has_role(uid,'admin') THEN RAISE EXCEPTION 'Owner access cannot be changed here';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=uid) THEN RAISE EXCEPTION 'Staff account not found';END IF;
 SELECT name INTO roleName FROM public.staff_roles WHERE id=(p->>'role_id')::uuid;IF roleName IS NULL THEN RAISE EXCEPTION 'Select a valid staff role';END IF;
 SELECT coalesce(array_agg(DISTINCT value),'{}') INTO bs FROM jsonb_array_elements_text(p->'branch_ids');
 IF roleName='Managing Director' THEN SELECT coalesce(array_agg(id ORDER BY code),'{}') INTO bs FROM public.branches WHERE active;END IF;
 IF cardinality(bs)=0 OR EXISTS(SELECT 1 FROM unnest(bs) b WHERE NOT EXISTS(SELECT 1 FROM public.branches WHERE id=b AND active)) THEN RAISE EXCEPTION 'Select active branches';END IF;
 IF nullif(trim(p->>'display_name'),'') IS NULL OR length(trim(p->>'display_name'))>100 THEN RAISE EXCEPTION 'Enter a valid staff name';END IF;
 INSERT INTO public.staff_access(user_id,role_id,branch_ids,active) VALUES(uid,(p->>'role_id')::uuid,bs,coalesce((p->>'active')::boolean,false)) ON CONFLICT(user_id) DO UPDATE SET role_id=excluded.role_id,branch_ids=excluded.branch_ids,active=excluded.active;
 UPDATE public.profiles SET display_name=trim(p->>'display_name') WHERE id=uid;
END $$;