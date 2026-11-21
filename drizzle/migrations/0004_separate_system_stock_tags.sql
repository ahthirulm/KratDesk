CREATE SEQUENCE public.system_tag_seq;
ALTER TABLE public.items ADD COLUMN system_tag text NOT NULL DEFAULT ('SYS-' || lpad(nextval('public.system_tag_seq')::text, 8, '0'));
ALTER TABLE public.items ADD CONSTRAINT items_system_tag_unique UNIQUE (system_tag);
GRANT USAGE, SELECT ON SEQUENCE public.system_tag_seq TO service_role;
COMMENT ON COLUMN public.items.system_tag IS 'Automatically assigned system stock number, separate from the shop-entered internal tag in tag_id.';