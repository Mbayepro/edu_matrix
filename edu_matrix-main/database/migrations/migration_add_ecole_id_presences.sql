-- ============================================================
-- MIGRATION: Add ecole_id to presences table and update RLS
-- ============================================================

-- 1. Ajout de la colonne
ALTER TABLE public.presences 
ADD COLUMN IF NOT EXISTS ecole_id UUID REFERENCES public.ecoles(id) ON DELETE CASCADE;

-- 2. Remplissage des données existantes (Backfill)
UPDATE public.presences p
SET ecole_id = e.ecole_id
FROM public.eleves e
WHERE p.eleve_id = e.id
  AND p.ecole_id IS NULL;

-- 3. Ajout de l'index pour la performance
CREATE INDEX IF NOT EXISTS idx_presences_ecole_id ON public.presences(ecole_id);

-- 4. Mise à jour des politiques RLS (Simplification)
DROP POLICY IF EXISTS "presences_director_all" ON public.presences;
DROP POLICY IF EXISTS "presences_teacher_all" ON public.presences;

CREATE POLICY "presences_director_all"
  ON public.presences FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

CREATE POLICY "presences_teacher_all"
  ON public.presences FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  );
