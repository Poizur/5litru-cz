-- Supabase advisor: rls_disabled_in_public (guide_images, product_images).
-- Web je nečte; zapisují/čtou je jen skripty přes service role → stejný vzor jako ostatní interní tabulky.
ALTER TABLE public.guide_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_guide_images ON public.guide_images;
CREATE POLICY service_role_all_guide_images ON public.guide_images
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_product_images ON public.product_images;
CREATE POLICY service_role_all_product_images ON public.product_images
  FOR ALL TO service_role USING (true) WITH CHECK (true);
