CREATE OR REPLACE FUNCTION public.save_item(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE iid uuid; tag text;
BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
tag:=nullif(trim(p->>'tag_id'),'');
IF p ? 'tag_id' AND tag IS NULL THEN RAISE EXCEPTION 'Enter the shop tag number'; END IF;
IF tag IS NOT NULL THEN
PERFORM pg_advisory_xact_lock(hashtextextended(lower(tag),0));
IF EXISTS(SELECT 1 FROM public.items WHERE lower(trim(tag_id))=lower(tag) AND id IS DISTINCT FROM (p->>'id')::uuid) THEN RAISE EXCEPTION 'This tag number already belongs to another piece'; END IF;
END IF;
IF p->>'id' IS NOT NULL THEN
iid:=(p->>'id')::uuid;
PERFORM 1 FROM public.items WHERE id=iid AND status='In Stock' FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Only in-stock pieces can be edited'; END IF;
UPDATE public.items SET tag_id=coalesce(tag,tag_id),name=p->>'name',metal_id=(p->>'metal_id')::uuid,weight=(p->>'weight')::numeric,supplier=p->>'supplier',photo_url=p->>'photo_url' WHERE id=iid;
ELSE
IF tag IS NULL THEN
INSERT INTO public.items(name,metal_id,weight,supplier,photo_url) VALUES(p->>'name',(p->>'metal_id')::uuid,(p->>'weight')::numeric,p->>'supplier',p->>'photo_url') RETURNING id INTO iid;
ELSE
INSERT INTO public.items(tag_id,name,metal_id,weight,supplier,photo_url) VALUES(tag,p->>'name',(p->>'metal_id')::uuid,(p->>'weight')::numeric,p->>'supplier',p->>'photo_url') RETURNING id INTO iid;
END IF;
END IF;
INSERT INTO public.item_costs VALUES(iid,(p->>'purchase_price')::numeric) ON CONFLICT(item_id) DO UPDATE SET purchase_price=excluded.purchase_price;
RETURN iid;
END $function$;