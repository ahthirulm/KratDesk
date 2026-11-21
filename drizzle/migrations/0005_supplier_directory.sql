CREATE TABLE public.suppliers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, contact_person text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true);
GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_read ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX suppliers_name_unique ON public.suppliers (lower(trim(name)));