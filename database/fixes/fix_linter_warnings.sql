-- Correction des Linter Warnings (Search Path Mutable)
-- Voir: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- Nous modifions les fonctions pour forcer le search_path = '' afin d'éviter les failles de sécurité.

ALTER FUNCTION public.generate_pin() SET search_path = '';
ALTER FUNCTION public.set_eleve_pin() SET search_path = '';
ALTER FUNCTION public.get_eleve_by_pin(TEXT) SET search_path = '';
ALTER FUNCTION public.get_absences_by_pin(TEXT) SET search_path = '';
ALTER FUNCTION public.get_bulletin_by_pin(TEXT, INTEGER) SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Correction des Linter Warnings (RLS Policy Always True)
-- Voir: https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy

-- Pour "emargements"
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.emargements;
CREATE POLICY "Acces emargements selon ecole"
ON public.emargements
FOR ALL
TO authenticated
USING (
  ecole_id IN (
    SELECT ecole_id FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  ecole_id IN (
    SELECT ecole_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Pour "presences"
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.presences;
CREATE POLICY "Acces presences selon ecole"
ON public.presences
FOR ALL
TO authenticated
USING (
  ecole_id IN (
    SELECT ecole_id FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  ecole_id IN (
    SELECT ecole_id FROM public.profiles WHERE id = auth.uid()
  )
);
