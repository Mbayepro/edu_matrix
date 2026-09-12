-- ============================================================
-- FIX: Missing RLS Policies for enseignants_classes AND emploi_du_temps
-- ============================================================

-- Enable RLS
ALTER TABLE public.enseignants_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emploi_du_temps     ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- TABLE: enseignants_classes
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "enseignants_classes_superadmin_all" ON public.enseignants_classes;
DROP POLICY IF EXISTS "enseignants_classes_director_all"   ON public.enseignants_classes;
DROP POLICY IF EXISTS "enseignants_classes_teacher_read"   ON public.enseignants_classes;

-- Superadmin: Full access
CREATE POLICY "enseignants_classes_superadmin_all"
  ON public.enseignants_classes FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- Director: Manage assignments in their own school
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

-- Teacher: Read their own assignments
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
DROP POLICY IF EXISTS "emploi_du_temps_student_read"   ON public.emploi_du_temps;

-- Superadmin: Full access
CREATE POLICY "emploi_du_temps_superadmin_all"
  ON public.emploi_du_temps FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- Director: Manage timetable in their own school
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

-- Teacher: Read timetable where they teach OR for classes in their school (if broader access needed)
-- Assuming teachers only need to see their own schedule or schedule of classes they teach
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
