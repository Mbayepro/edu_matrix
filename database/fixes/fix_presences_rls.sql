-- ============================================================
-- FIX: RLS Policies for presences table (Fix 403 Forbidden errors)
-- ============================================================

-- 1. Activer RLS
ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques
DROP POLICY IF EXISTS "presences_superadmin_all"  ON public.presences;
DROP POLICY IF EXISTS "presences_director_select" ON public.presences;
DROP POLICY IF EXISTS "presences_director_all"    ON public.presences;
DROP POLICY IF EXISTS "presences_teacher_all"     ON public.presences;

-- 3. Recréer les bonnes politiques pour autoriser INSERT/UPDATE
CREATE POLICY "presences_superadmin_all"
  ON public.presences FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- Autoriser le directeur à tout faire dans son école
CREATE POLICY "presences_director_all"
  ON public.presences FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM public.eleves e
      WHERE e.id = presences.eleve_id
        AND e.ecole_id = public.get_my_ecole_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM public.eleves e
      WHERE e.id = presences.eleve_id
        AND e.ecole_id = public.get_my_ecole_id()
    )
  );

-- Autoriser le professeur à tout faire dans son école
CREATE POLICY "presences_teacher_all"
  ON public.presences FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.eleves e
      WHERE e.id = presences.eleve_id
        AND e.ecole_id = public.get_my_ecole_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.eleves e
      WHERE e.id = presences.eleve_id
        AND e.ecole_id = public.get_my_ecole_id()
    )
  );
