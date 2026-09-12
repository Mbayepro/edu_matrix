-- ============================================================
-- FIX: Create missing evaluations table and RLS policies
-- ============================================================

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.evaluations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id    UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  classe_id   UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  matiere_id  UUID NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  trimestre   INTEGER NOT NULL CHECK (trimestre IN (1,2,3)),
  type        TEXT NOT NULL CHECK (type IN ('controle', 'devoir', 'composition')),
  date        DATE NOT NULL,
  coef        NUMERIC NOT NULL DEFAULT 1,
  bareme      NUMERIC NOT NULL DEFAULT 20,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Si la table existait déjà (créée juste avant sans la colonne bareme), on l'ajoute :
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS bareme NUMERIC NOT NULL DEFAULT 20;

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_evaluations_classe_id ON public.evaluations(classe_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_matiere_id ON public.evaluations(matiere_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_ecole_id ON public.evaluations(ecole_id);

-- 3. Enable RLS
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "evaluations_superadmin_all" ON public.evaluations;
DROP POLICY IF EXISTS "evaluations_director_all"   ON public.evaluations;
DROP POLICY IF EXISTS "evaluations_teacher_all"    ON public.evaluations;

CREATE POLICY "evaluations_superadmin_all"
  ON public.evaluations FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "evaluations_director_all"
  ON public.evaluations FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

CREATE POLICY "evaluations_teacher_all"
  ON public.evaluations FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  );
