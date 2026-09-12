-- ============================================================
-- FIX: Missing RLS Policies for matieres and evaluations
-- ============================================================

-- Enable RLS
ALTER TABLE public.matieres ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- TABLE: matieres
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "matieres_superadmin_all" ON public.matieres;
DROP POLICY IF EXISTS "matieres_director_all"   ON public.matieres;
DROP POLICY IF EXISTS "matieres_teacher_select" ON public.matieres;

CREATE POLICY "matieres_superadmin_all"
  ON public.matieres FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "matieres_director_all"
  ON public.matieres FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

CREATE POLICY "matieres_teacher_select"
  ON public.matieres FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  );
