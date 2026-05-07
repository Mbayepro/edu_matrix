-- ============================================================
-- EDUMATRIX - FIX URGENT CONNEXION (Restaurer les permissions)
-- ============================================================
-- PROBLÈME : Le script fix_security_linter_v3.sql a révoqué
--            l'accès aux fonctions get_my_role() et get_my_ecole_id()
--            pour le rôle 'authenticated', ce qui bloque TOUTES
--            les politiques RLS et empêche la connexion.
-- ============================================================

-- 1. Restaurer l'accès aux fonctions RLS helper critiques
--    Ces fonctions DOIVENT être accessibles par les utilisateurs
--    connectés car TOUTES les politiques RLS en dépendent.
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_ecole_id() TO authenticated;

-- 2. Restaurer aussi calculate_moyenne_ponderee et recalculate_statut_paiement
--    car elles sont utilisées par le front-end
GRANT EXECUTE ON FUNCTION public.calculate_moyenne_ponderee(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_statut_paiement(uuid) TO authenticated;

-- 3. Restaurer get_payment_coverage_status si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_payment_coverage_status'
    AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_payment_coverage_status(uuid) TO authenticated';
  END IF;
END $$;

-- 4. Les fonctions de trigger (handle_new_user, generate_matricule, etc.)
--    n'ont PAS besoin d'être accessibles par authenticated car elles
--    sont appelées automatiquement par les triggers (postgres role).
--    On les laisse révoquées = correct.

-- 5. Rafraîchir le cache PostgREST
NOTIFY pgrst, 'reload schema';

-- VÉRIFICATION : tester que les fonctions sont accessibles
-- Exécutez ceci après le script pour vérifier :
-- SELECT public.get_my_role();
-- SELECT public.get_my_ecole_id();
