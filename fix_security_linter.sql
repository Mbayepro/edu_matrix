-- ============================================================
-- EDUMATRIX - Fix Supabase Security Linter Errors
-- Run this script once in the Supabase SQL Editor
-- 2026-03-25
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX 1: Enable RLS on the 4 tables that have policies but
--         RLS is not activated  (lint: policy_exists_rls_disabled
--         + rls_disabled_in_public)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.classes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecoles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eleves             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enseignants_classes ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────
-- FIX 2: Remove the SECURITY DEFINER property from the view
--         v_moyennes_coefficients  (lint: security_definer_view)
--
-- In PostgreSQL / Supabase the default for views is
-- SECURITY INVOKER (runs as the querying user, respecting RLS).
-- Re-creating the view without SECURITY DEFINER restores that.
-- ─────────────────────────────────────────────────────────────

-- Drop dependent view first (v_moyennes_generales references this view)
DROP VIEW IF EXISTS public.v_moyennes_generales CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_coefficients CASCADE;

-- Recreate WITHOUT SECURITY DEFINER  (SECURITY INVOKER is the default)
CREATE VIEW public.v_moyennes_coefficients
WITH (security_invoker = true)   -- explicit, recommended by Supabase docs
AS
SELECT
    e.id                                             AS eleve_id,
    e.nom                                            AS eleve_nom,
    e.prenom                                         AS eleve_prenom,
    c.id                                             AS classe_id,
    c.nom_classe,
    c.niveau                                         AS niveau_classe,
    m.id                                             AS matiere_id,
    m.nom                                            AS matiere_nom,
    cn.coefficient,
    ROUND(AVG(n.note), 2)                            AS moyenne_matiere,
    ROUND(AVG(n.note) * cn.coefficient, 2)           AS moyenne_ponderee,
    COUNT(n.id)                                      AS nombre_notes,
    ev.trimestre
FROM public.eleves e
JOIN public.classes              c  ON e.classe_id      = c.id
JOIN public.notes                n  ON n.eleve_id        = e.id
JOIN public.evaluations          ev ON n.evaluation_id  = ev.id
JOIN public.matieres             m  ON ev.matiere_id    = m.id
LEFT JOIN public.coefficients_niveaux cn ON
    cn.niveau    = c.niveau
    AND (cn.matiere_id = m.id OR cn.matiere_nom = m.nom)
    AND cn.ecole_id    = e.ecole_id
WHERE e.ecole_id IS NOT NULL
GROUP BY
    e.id, e.nom, e.prenom,
    c.id, c.nom_classe, c.niveau,
    m.id, m.nom, cn.coefficient,
    ev.trimestre
ORDER BY e.nom, e.prenom, m.nom;

-- Recreate the dependent view
CREATE VIEW public.v_moyennes_generales
WITH (security_invoker = true)
AS
SELECT
    eleve_id,
    eleve_nom,
    eleve_prenom,
    classe_id,
    nom_classe,
    niveau_classe,
    trimestre,
    CASE
        WHEN SUM(coefficient) > 0 THEN
            ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2)
        ELSE 0
    END AS moyenne_generale,
    CASE
        WHEN SUM(coefficient) > 0 THEN
            CASE
                WHEN ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2) < 10 THEN 'Insuffisant'
                WHEN ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2) < 12 THEN 'Passable'
                WHEN ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2) < 14 THEN 'Assez bien'
                WHEN ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2) < 16 THEN 'Bien'
                ELSE 'Très bien'
            END
        ELSE 'Insuffisant'
    END AS mention,
    SUM(coefficient)  AS total_coefficients,
    COUNT(*)          AS nombre_matieres
FROM public.v_moyennes_coefficients
WHERE moyenne_matiere > 0
GROUP BY
    eleve_id, eleve_nom, eleve_prenom,
    classe_id, nom_classe, niveau_classe,
    trimestre
ORDER BY eleve_nom, eleve_prenom, trimestre;


-- ─────────────────────────────────────────────────────────────
-- Grant SELECT on the views to authenticated users
-- (the views are SECURITY INVOKER so underlying table RLS
--  policies will still apply per-user)
-- ─────────────────────────────────────────────────────────────
GRANT SELECT ON public.v_moyennes_coefficients TO authenticated;
GRANT SELECT ON public.v_moyennes_generales    TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────
-- VERIFICATION  (run after the script to confirm)
-- ─────────────────────────────────────────────────────────────
/*
SELECT relname, relrowsecurity
FROM   pg_class
WHERE  relname IN ('classes', 'ecoles', 'eleves', 'enseignants_classes')
  AND  relnamespace = 'public'::regnamespace;
-- Expected: relrowsecurity = true for all 4 rows

SELECT table_name, is_security_invoker
FROM   information_schema.views
WHERE  table_schema = 'public'
  AND  table_name IN ('v_moyennes_coefficients', 'v_moyennes_generales');
-- Expected: is_security_invoker = YES for both rows
*/
