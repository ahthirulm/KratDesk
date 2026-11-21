ALTER TABLE public.items
  ALTER COLUMN system_tag SET DEFAULT ('KD' || lpad(nextval('public.system_tag_seq')::text, 6, '0'));

ALTER TABLE public.items DISABLE TRIGGER branch_items;

UPDATE public.items
SET system_tag = 'KD' || lpad((substring(system_tag from '([0-9]+)$')::bigint)::text, 6, '0')
WHERE system_tag ~ '^SYS-[0-9]+$';

ALTER TABLE public.items ENABLE TRIGGER branch_items;

ALTER TABLE public.items
  ADD CONSTRAINT items_system_tag_format CHECK (system_tag ~ '^KD[0-9]{6,}$');

COMMENT ON COLUMN public.items.system_tag IS 'Short unique system stock number used on compact jewellery barcode labels; separate from the shop-entered internal tag.';