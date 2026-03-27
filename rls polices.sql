-- ============================================================
-- EDUMATRIX - Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.ecoles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eleves          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frais_scolaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eleves_frais    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coefficients_matieres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matieres           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niveaux            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enseignants_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emploi_du_temps     ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- TABLE: ecoles
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "ecoles_superadmin_all"   ON public.ecoles;
DROP POLICY IF EXISTS "ecoles_director_select"  ON public.ecoles;
DROP POLICY IF EXISTS "ecoles_director_update"  ON public.ecoles;
DROP POLICY IF EXISTS "ecoles_director_insert"  ON public.ecoles;
DROP POLICY IF EXISTS "ecoles_teacher_select"   ON public.ecoles;

-- Superadmin: full access
CREATE POLICY "ecoles_superadmin_all"
  ON public.ecoles
  FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- Director: read own school only
CREATE POLICY "ecoles_director_select"
  ON public.ecoles
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND id = public.get_my_ecole_id()
  );

-- Director: update own school
CREATE POLICY "ecoles_director_update"
  ON public.ecoles
  FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND id = public.get_my_ecole_id()
  );

-- Director: insert new school (during signup)
CREATE POLICY "ecoles_director_insert"
  ON public.ecoles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow insert if user has no school yet OR is director
    -- Ideally, we check if the user is creating it for themselves
    public.get_my_role() = 'director' 
  );

-- Teacher: read own school only
CREATE POLICY "ecoles_teacher_select"
  ON public.ecoles
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND id = public.get_my_ecole_id()
  );


-- ─────────────────────────────────────────
-- TABLE: profiles
-- NOTE: Uses SECURITY DEFINER functions
-- to prevent infinite RLS loop
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_superadmin_all"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_director_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_select"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_insert"      ON public.profiles;

-- Superadmin: full access
CREATE POLICY "profiles_superadmin_all"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- Director: see all profiles in their school
CREATE POLICY "profiles_director_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

-- Any user: always see their own profile
CREATE POLICY "profiles_own_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Any user: update their own profile
CREATE POLICY "profiles_own_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─────────────────────────────────────────
-- TABLE: classes
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "classes_superadmin_all"  ON public.classes;
DROP POLICY IF EXISTS "classes_director_all"    ON public.classes;
DROP POLICY IF EXISTS "classes_teacher_select"  ON public.classes;

CREATE POLICY "classes_superadmin_all"
  ON public.classes FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "classes_director_all"
  ON public.classes FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

CREATE POLICY "classes_teacher_select"
  ON public.classes FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  );


-- ─────────────────────────────────────────
-- TABLE: eleves
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "eleves_superadmin_all" ON public.eleves;
DROP POLICY IF EXISTS "eleves_director_all"   ON public.eleves;
DROP POLICY IF EXISTS "eleves_teacher_select" ON public.eleves;

CREATE POLICY "eleves_superadmin_all"
  ON public.eleves FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "eleves_director_all"
  ON public.eleves FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

-- Teachers can see students in their school
CREATE POLICY "eleves_teacher_select"
  ON public.eleves FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  );


-- ─────────────────────────────────────────
-- TABLE: notes
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "notes_superadmin_all"   ON public.notes;
DROP POLICY IF EXISTS "notes_director_all"     ON public.notes;
DROP POLICY IF EXISTS "notes_director_select"  ON public.notes;
DROP POLICY IF EXISTS "notes_teacher_all"      ON public.notes;

CREATE POLICY "notes_superadmin_all"
  ON public.notes FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- Director can manage all notes in their school
CREATE POLICY "notes_director_all"
  ON public.notes FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM public.eleves e
      WHERE e.id = notes.eleve_id
        AND e.ecole_id = public.get_my_ecole_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM public.eleves e
      WHERE e.id = notes.eleve_id
        AND e.ecole_id = public.get_my_ecole_id()
    )
  );

-- Teachers can manage their own notes
CREATE POLICY "notes_teacher_all"
  ON public.notes FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND (
      professeur_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      OR EXISTS (
        SELECT 1 FROM public.eleves e
        WHERE e.id = notes.eleve_id
          AND e.ecole_id = public.get_my_ecole_id()
      )
    )
  )
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND (
      professeur_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      OR professeur_id IS NULL 
    )
  );


-- ─────────────────────────────────────────
-- TABLE: presences
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "presences_superadmin_all"  ON public.presences;
DROP POLICY IF EXISTS "presences_director_select" ON public.presences;
DROP POLICY IF EXISTS "presences_teacher_all"     ON public.presences;

CREATE POLICY "presences_superadmin_all"
  ON public.presences FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "presences_director_select"
  ON public.presences FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM public.eleves e
      WHERE e.id = presences.eleve_id
        AND e.ecole_id = public.get_my_ecole_id()
    )
  );

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


-- ─────────────────────────────────────────
-- TABLE: matricule_sequences
-- ─────────────────────────────────────────
-- No RLS needed for matricule_sequences as it is only accessed via SECURITY DEFINER functions
-- but good practice to enable it and deny all direct access
ALTER TABLE public.matricule_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matricule_sequences_deny_all" ON public.matricule_sequences;

CREATE POLICY "matricule_sequences_deny_all"
  ON public.matricule_sequences
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);


-- ─────────────────────────────────────────
-- Grant execute permissions on helper functions
-- ─────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_my_ecole_id()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_moyenne_ponderee(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_statut_paiement(UUID)         TO authenticated;


-- ─────────────────────────────────────────
-- TABLE: frais_scolaires
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "frais_superadmin_all"  ON public.frais_scolaires;
DROP POLICY IF EXISTS "frais_director_all"    ON public.frais_scolaires;

CREATE POLICY "frais_superadmin_all"
  ON public.frais_scolaires FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "frais_director_all"
  ON public.frais_scolaires FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

-- ─────────────────────────────────────────
-- TABLE: eleves_frais
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "eleves_frais_superadmin_all" ON public.eleves_frais;
DROP POLICY IF EXISTS "eleves_frais_director_all"   ON public.eleves_frais;

CREATE POLICY "eleves_frais_superadmin_all"
  ON public.eleves_frais FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "eleves_frais_director_all"
  ON public.eleves_frais FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

-- ─────────────────────────────────────────
-- TABLE: paiements
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "paiements_superadmin_all" ON public.paiements;
DROP POLICY IF EXISTS "paiements_director_all"   ON public.paiements;

CREATE POLICY "paiements_superadmin_all"
  ON public.paiements FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "paiements_director_all"
  ON public.paiements FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

-- ─────────────────────────────────────────
-- TABLE: coefficients_matieres
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "coefficients_superadmin_all" ON public.coefficients_matieres;
DROP POLICY IF EXISTS "coefficients_director_all"   ON public.coefficients_matieres;
DROP POLICY IF EXISTS "coefficients_teacher_select" ON public.coefficients_matieres;

CREATE POLICY "coefficients_superadmin_all"
  ON public.coefficients_matieres FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "coefficients_director_all"
  ON public.coefficients_matieres FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

CREATE POLICY "coefficients_teacher_select"
  ON public.coefficients_matieres FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  );

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

-- ─────────────────────────────────────────
-- TABLE: niveaux
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "niveaux_superadmin_all" ON public.niveaux;
DROP POLICY IF EXISTS "niveaux_director_all"   ON public.niveaux;
DROP POLICY IF EXISTS "niveaux_teacher_select" ON public.niveaux;

CREATE POLICY "niveaux_superadmin_all"
  ON public.niveaux FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "niveaux_director_all"
  ON public.niveaux FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

CREATE POLICY "niveaux_teacher_select"
  ON public.niveaux FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  );

-- ─────────────────────────────────────────
-- TABLE: series
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "series_superadmin_all" ON public.series;
DROP POLICY IF EXISTS "series_director_all"   ON public.series;
DROP POLICY IF EXISTS "series_teacher_select" ON public.series;

CREATE POLICY "series_superadmin_all"
  ON public.series FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "series_director_all"
  ON public.series FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND ecole_id = public.get_my_ecole_id()
  );

CREATE POLICY "series_teacher_select"
  ON public.series FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND ecole_id = public.get_my_ecole_id()
  );

-- ─────────────────────────────────────────
-- TABLE: evaluations
-- ─────────────────────────────────────────
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

-- ─────────────────────────────────────────
-- TABLE: enseignants_classes
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "enseignants_classes_superadmin_all" ON public.enseignants_classes;
DROP POLICY IF EXISTS "enseignants_classes_director_all"   ON public.enseignants_classes;
DROP POLICY IF EXISTS "enseignants_classes_teacher_read"   ON public.enseignants_classes;

CREATE POLICY "enseignants_classes_superadmin_all"
  ON public.enseignants_classes FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "enseignants_classes_director_all"
  ON public.enseignants_classes FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = enseignants_classes.classe_id
        AND c.ecole_id = public.get_my_ecole_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = enseignants_classes.classe_id
        AND c.ecole_id = public.get_my_ecole_id()
    )
  );

CREATE POLICY "enseignants_classes_teacher_read"
  ON public.enseignants_classes FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND enseignant_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- ─────────────────────────────────────────
-- TABLE: emploi_du_temps
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "emploi_du_temps_superadmin_all" ON public.emploi_du_temps;
DROP POLICY IF EXISTS "emploi_du_temps_director_all"   ON public.emploi_du_temps;
DROP POLICY IF EXISTS "emploi_du_temps_teacher_read"   ON public.emploi_du_temps;

CREATE POLICY "emploi_du_temps_superadmin_all"
  ON public.emploi_du_temps FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "emploi_du_temps_director_all"
  ON public.emploi_du_temps FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = emploi_du_temps.classe_id
        AND c.ecole_id = public.get_my_ecole_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = emploi_du_temps.classe_id
        AND c.ecole_id = public.get_my_ecole_id()
    )
  );

CREATE POLICY "emploi_du_temps_teacher_read"
  ON public.emploi_du_temps FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND (
      enseignant_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      OR
      EXISTS (
         SELECT 1 FROM public.classes c
         WHERE c.id = emploi_du_temps.classe_id
         AND c.ecole_id = public.get_my_ecole_id()
      )
    )
  );