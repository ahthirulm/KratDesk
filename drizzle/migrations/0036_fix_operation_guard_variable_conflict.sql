CREATE OR REPLACE FUNCTION public.operation_begin(p jsonb,kind text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE key uuid;existing uuid;stored_hash text;requested_kind text:=kind;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Staff login required';END IF;
 IF nullif(p->>'request_id','') IS NULL THEN RETURN NULL;END IF;
 key:=(p->>'request_id')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||requested_kind||':'||key::text,0));
 SELECT result_id,payload_hash INTO existing,stored_hash FROM public.operation_requests WHERE actor_id=auth.uid() AND operation_requests.kind=requested_kind AND request_id=key;
 IF FOUND THEN
  IF stored_hash<>md5((p-'request_id')::text) THEN RAISE EXCEPTION 'This request key was already used for different details';END IF;
  RETURN existing;
 END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.operation_finish(p jsonb,kind text,result uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE requested_kind text:=kind;
BEGIN
 IF nullif(p->>'request_id','') IS NOT NULL THEN
  INSERT INTO public.operation_requests(actor_id,kind,request_id,payload_hash,result_id) VALUES(auth.uid(),requested_kind,(p->>'request_id')::uuid,md5((p-'request_id')::text),result);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.operation_begin(jsonb,text),public.operation_finish(jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.operation_begin(jsonb,text),public.operation_finish(jsonb,text,uuid) TO service_role;