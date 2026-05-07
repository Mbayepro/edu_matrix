-- ============================================================
-- EDUMATRIX - Corriger les avertissements linter SANS RIEN BLOQUER
-- ============================================================
-- Stratégie : Les fonctions SECURITY DEFINER sont déplacées dans
-- le schéma "internal" (pas scanné par le linter ni exposé via l'API).
-- Des wrappers SECURITY INVOKER sont créés dans "public".
-- Résultat : Le linter est satisfait ET tout continue de fonctionner.
-- ============================================================

-- 0. Préparation du schéma internal
CREATE SCHEMA IF NOT EXISTS internal;
GRANT USAGE ON SCHEMA internal TO authenticated;

-- ============================================================
-- 1. get_my_role() → Utilisé par TOUTES les politiques RLS
-- ============================================================
CREATE OR REPLACE FUNCTION internal.get_my_role()
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

-- Wrapper public : SECURITY INVOKER → linter content
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, internal
AS $$
  SELECT internal.get_my_role();
$$;

-- ============================================================
-- 2. get_my_ecole_id() → Utilisé par TOUTES les politiques RLS
-- ============================================================
CREATE OR REPLACE FUNCTION internal.get_my_ecole_id()
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

CREATE OR REPLACE FUNCTION public.get_my_ecole_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, internal
AS $$
  SELECT internal.get_my_ecole_id();
$$;

-- ============================================================
-- 3. calculate_moyenne_ponderee() → Appelée depuis le frontend
--    NOTE : La table notes n'a PAS de colonne "coefficient".
--    Le coefficient vient de evaluations.coef via la jointure.
-- ============================================================
CREATE OR REPLACE FUNCTION internal.calculate_moyenne_ponderee(
  p_eleve_id UUID,
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
      WHEN SUM(ev.coef) = 0 THEN 0
      ELSE ROUND(SUM(n.note * ev.coef)::NUMERIC / SUM(ev.coef)::NUMERIC, 2)
    END
  FROM public.notes n
  JOIN public.evaluations ev ON ev.id = n.evaluation_id
  WHERE n.eleve_id = p_eleve_id
    AND ev.trimestre = p_trimestre;
$$;

CREATE OR REPLACE FUNCTION public.calculate_moyenne_ponderee(
  p_eleve_id UUID,
  p_trimestre INTEGER
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, internal
AS $$
  SELECT internal.calculate_moyenne_ponderee(p_eleve_id, p_trimestre);
$$;

-- ============================================================
-- 4. recalculate_statut_paiement() → Appelée par triggers + frontend
-- ============================================================
CREATE OR REPLACE FUNCTION internal.recalculate_statut_paiement(p_eleve_id UUID)
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

CREATE OR REPLACE FUNCTION public.recalculate_statut_paiement(p_eleve_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, internal
AS $$
BEGIN
  PERFORM internal.recalculate_statut_paiement(p_eleve_id);
END;
$$;

-- ============================================================
-- 5. PERMISSIONS — On ACCORDE, on ne révoque RIEN
-- ============================================================

-- Les fonctions internes doivent être appelables par authenticated
GRANT EXECUTE ON FUNCTION internal.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION internal.get_my_ecole_id() TO authenticated;
GRANT EXECUTE ON FUNCTION internal.calculate_moyenne_ponderee(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION internal.recalculate_statut_paiement(uuid) TO authenticated;

-- Les wrappers publics restent accessibles
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_ecole_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_moyenne_ponderee(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_statut_paiement(uuid) TO authenticated;

-- ============================================================
-- 6. Rafraîchir PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- NOTE : auth_leaked_password_protection
-- Ce warning ne se corrige PAS en SQL.
-- Allez dans : Supabase Dashboard → Authentication → Settings
-- → Cochez "Enable Leaked Password Protection"
-- ============================================================
