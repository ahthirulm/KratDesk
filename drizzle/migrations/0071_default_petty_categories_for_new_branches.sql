CREATE OR REPLACE FUNCTION public.seed_branch_petty_categories() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.petty_cash_categories(branch_id,name,requires_staff,requires_month)
  SELECT NEW.id, n, n='Salaries', n='Salaries'
  FROM unnest(ARRAY['Salaries','Refreshments','Transport','Utilities','Stationery','Repairs','Other']) n
  WHERE NOT EXISTS(SELECT 1 FROM public.petty_cash_categories c WHERE c.branch_id=NEW.id AND lower(c.name)=lower(n));
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.seed_branch_petty_categories() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS seed_petty_categories ON public.branches;
CREATE TRIGGER seed_petty_categories AFTER INSERT ON public.branches FOR EACH ROW EXECUTE FUNCTION public.seed_branch_petty_categories();