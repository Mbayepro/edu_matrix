-- ============================================================
-- EDUMATRIX - SQL Triggers
-- ============================================================

-- ─────────────────────────────────────────
-- SEQUENCE: matricule counter per year
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matricule_sequences (
  annee  INTEGER PRIMARY KEY,
  compteur INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────
-- FUNCTION: generate_matricule()
-- Format: EM-YY-XXXX
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_matricule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee     INTEGER;
  v_annee_yy  TEXT;
  v_compteur  INTEGER;
  v_matricule TEXT;
BEGIN
  -- Extract current year
  v_annee    := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_annee_yy := RIGHT(v_annee::TEXT, 2);

  -- Upsert sequence row for this year, increment atomically
  INSERT INTO public.matricule_sequences (annee, compteur)
  VALUES (v_annee, 1)
  ON CONFLICT (annee)
  DO UPDATE SET compteur = matricule_sequences.compteur + 1
  RETURNING compteur INTO v_compteur;

  -- Build matricule: EM-YY-XXXX
  v_matricule := 'EM-' || v_annee_yy || '-' || LPAD(v_compteur::TEXT, 4, '0');

  NEW.matricule := v_matricule;
  RETURN NEW;
END;
$$;

-- Attach trigger to eleves table
DROP TRIGGER IF EXISTS trg_generate_matricule ON public.eleves;
CREATE TRIGGER trg_generate_matricule
  BEFORE INSERT ON public.eleves
  FOR EACH ROW
  WHEN (NEW.matricule IS NULL OR NEW.matricule = '')
  EXECUTE FUNCTION public.generate_matricule();


-- ─────────────────────────────────────────
-- FUNCTION: handle_new_user()
-- Auto-creates a profile on signup
-- Uses SECURITY DEFINER to bypass RLS
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     TEXT;
  v_nom      TEXT;
  v_prenom   TEXT;
  v_ecole_id UUID;
  v_nom_ecole TEXT;
  v_ville_ecole TEXT;
  v_tel_ecole TEXT;
BEGIN
  -- Read metadata passed at signup
  v_role     := COALESCE(NEW.raw_user_meta_data->>'role',     'teacher');
  v_nom      := COALESCE(NEW.raw_user_meta_data->>'nom',      'Inconnu');
  v_prenom   := COALESCE(NEW.raw_user_meta_data->>'prenom',   'Inconnu');
  
  -- Check if ecole_id is provided directly
  v_ecole_id := (NEW.raw_user_meta_data->>'ecole_id')::UUID;

  -- If no ecole_id but user is director and provides school info, create school
  IF v_ecole_id IS NULL AND v_role = 'director' THEN
    v_nom_ecole   := NEW.raw_user_meta_data->>'nom_ecole';
    v_ville_ecole := NEW.raw_user_meta_data->>'ville_ecole';
    v_tel_ecole   := NEW.raw_user_meta_data->>'telephone_ecole';

    IF v_nom_ecole IS NOT NULL THEN
      INSERT INTO public.ecoles (nom, ville, telephone, statut)
      VALUES (v_nom_ecole, COALESCE(v_ville_ecole, 'Dakar'), v_tel_ecole, 'en_attente')
      RETURNING id INTO v_ecole_id;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, ecole_id, role, nom, prenom)
  VALUES (NEW.id, v_ecole_id, v_role, v_nom, v_prenom)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────
-- FUNCTION: get_my_ecole_id()
-- Helper: returns current user's ecole_id
-- SECURITY DEFINER prevents RLS infinite loop
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_ecole_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ecole_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ─────────────────────────────────────────
-- FUNCTION: get_my_role()
-- Helper: returns current user's role
-- SECURITY DEFINER prevents RLS infinite loop
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;


-- ─────────────────────────────────────────
-- FUNCTION: calculate_moyenne_ponderee()
-- Returns weighted average for a student
-- in a given trimestre
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_moyenne_ponderee(
  p_eleve_id  UUID,
  p_trimestre INTEGER
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN SUM(coefficient) = 0 THEN 0
      ELSE ROUND(SUM(note * coefficient)::NUMERIC / SUM(coefficient)::NUMERIC, 2)
    END
  FROM public.notes
  WHERE eleve_id = p_eleve_id
    AND trimestre = p_trimestre;
$$;


-- ─────────────────────────────────────────
-- FUNCTION: recalculate_statut_paiement()
-- Met à jour le champ statut_paiement de public.eleves
-- en fonction des montants dus et payés
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_statut_paiement(p_eleve_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_du   NUMERIC(10,2);
  v_total_paye NUMERIC(10,2);
  v_statut     TEXT;
BEGIN
  SELECT COALESCE(SUM(montant_a_payer), 0)
  INTO v_total_du
  FROM public.eleves_frais
  WHERE eleve_id = p_eleve_id;

  SELECT COALESCE(SUM(montant), 0)
  INTO v_total_paye
  FROM public.paiements
  WHERE eleve_id = p_eleve_id;

  IF v_total_paye >= v_total_du AND v_total_du > 0 THEN
    v_statut := 'payé';
  ELSIF v_total_paye > 0 AND v_total_paye < v_total_du THEN
    v_statut := 'partiel';
  ELSIF v_total_paye > 0 AND v_total_du <= 0 THEN
    v_statut := 'payé';
  ELSE
    v_statut := 'impayé';
  END IF;

  UPDATE public.eleves
  SET statut_paiement = v_statut
  WHERE id = p_eleve_id;
END;
$$;

-- ─────────────────────────────────────────
-- FUNCTION: recalculate_statut_paiement_trigger()
-- Wrapper function for triggers
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_statut_paiement_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_statut_paiement(
    COALESCE(NEW.eleve_id, OLD.eleve_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers pour recalculer après modification des frais ou paiements
DROP TRIGGER IF EXISTS trg_recalculate_statut_paiement_on_paiements ON public.paiements;
CREATE TRIGGER trg_recalculate_statut_paiement_on_paiements
  AFTER INSERT OR UPDATE OR DELETE ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_statut_paiement_trigger();

DROP TRIGGER IF EXISTS trg_recalculate_statut_paiement_on_eleves_frais ON public.eleves_frais;
CREATE TRIGGER trg_recalculate_statut_paiement_on_eleves_frais
  AFTER INSERT OR UPDATE OR DELETE ON public.eleves_frais
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_statut_paiement_trigger();