-- ============================================================
-- FIX: RLS Policies for notes table (Fix Insert/Update errors)
-- ============================================================

-- 1. Activer RLS au cas où
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques qui posent problème
DROP POLICY IF EXISTS "notes_superadmin_all"   ON public.notes;
DROP POLICY IF EXISTS "notes_director_select"  ON public.notes;
DROP POLICY IF EXISTS "notes_director_all"     ON public.notes;
DROP POLICY IF EXISTS "notes_teacher_all"      ON public.notes;

-- 3. Recréer les bonnes politiques (Superadmin: tout, Director: tout dans son école, Teacher: tout dans son école)
CREATE POLICY "notes_superadmin_all"
  ON public.notes FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- Autoriser le directeur à TOUT FAIRE (Select, Insert, Update, Delete) dans son école
CREATE POLICY "notes_director_all"
  ON public.notes FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

-- Autoriser les professeurs à TOUT FAIRE (Select, Insert, Update, Delete) dans leur école
CREATE POLICY "notes_teacher_all"
  ON public.notes FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  );
