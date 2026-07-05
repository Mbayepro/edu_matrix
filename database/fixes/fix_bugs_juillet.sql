-- ============================================================
-- EDUMATRIX - FIX BUGS JUILLET
-- 1. Réparation de l'upload des photos (bucket eleves-photos)
-- 2. Ajout de annee_scolaire à evaluations
-- 3. Mise à jour des vues pour inclure annee_scolaire
-- ============================================================

-- 1. FIX: Photo Upload (Bucket)
-- Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('eleves-photos', 'eleves-photos', true) 
ON CONFLICT (id) DO NOTHING;

-- Rétablir les politiques pour permettre l'upload public et la lecture publique (si nécessaire)
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;

CREATE POLICY "Allow public uploads" ON storage.objects 
FOR INSERT TO public 
WITH CHECK (bucket_id = 'eleves-photos');

-- Note: No SELECT policy is created here because 'eleves-photos' is a public bucket.
-- Public buckets do not need a SELECT policy to serve files via public URLs.
-- Creating a SELECT policy would allow users to list all files, which triggers a security linter warning.


-- 2. FIX: Ajout de annee_scolaire à la table evaluations
ALTER TABLE public.evaluations 
ADD COLUMN IF NOT EXISTS annee_scolaire TEXT;

UPDATE public.evaluations 
SET annee_scolaire = '2024-2025' 
WHERE annee_scolaire IS NULL;

-- 3. FIX: Mise à jour des vues pour propager l'année scolaire

DROP VIEW IF EXISTS public.v_bulletins_complets CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_generales CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_matieres CASCADE;

-- Vue pour les moyennes par matière et par élève
CREATE OR REPLACE VIEW public.v_moyennes_matieres WITH (security_invoker = true) AS
SELECT 
  e.id as eleve_id,
  e.prenom,
  e.nom,
  e.matricule,
  c.id as classe_id,
  c.nom_classe,
  niv.code as niveau_code,
  niv.cycle,
  COALESCE(s.code, '') as serie_code,
  m.id as matiere_id,
  m.nom as matiere_nom,
  ev.trimestre,
  ev.annee_scolaire,
  COALESCE(cm.coefficient, 1) as coefficient,
  -- Calcul de la moyenne pondérée par les coefficients des évaluations
  CASE 
    WHEN COUNT(notes.id) > 0 THEN 
      ROUND(SUM(notes.note * ev.coef) / SUM(ev.coef), 2)
    ELSE 0 
  END as moyenne_matiere,
  COUNT(notes.id) as nombre_evaluations,
  MIN(ev.date) as premiere_evaluation,
  MAX(ev.date) as derniere_evaluation
FROM public.eleves e
JOIN public.classes c ON e.classe_id = c.id
JOIN public.evaluations ev ON ev.classe_id = c.id
JOIN public.matieres m ON ev.matiere_id = m.id
LEFT JOIN public.niveaux niv ON c.niveau_id = niv.id
LEFT JOIN public.series s ON c.serie_id = s.id
LEFT JOIN public.coefficients_matieres cm ON 
  cm.matiere_id = m.id AND 
  cm.niveau_id = niv.id AND 
  (cm.serie_id = s.id OR (cm.serie_id IS NULL AND s.id IS NULL))
LEFT JOIN public.notes notes ON 
  notes.evaluation_id = ev.id AND 
  notes.eleve_id = e.id
WHERE e.created_at IS NOT NULL
GROUP BY e.id, e.prenom, e.nom, e.matricule, c.id, c.nom_classe, 
         niv.id, niv.code, niv.cycle, s.code, m.id, m.nom, ev.trimestre, ev.annee_scolaire, cm.coefficient;

-- Vue pour les moyennes générales
CREATE OR REPLACE VIEW public.v_moyennes_generales WITH (security_invoker = true) AS
SELECT 
  eleve_id,
  prenom,
  nom,
  matricule,
  classe_id,
  nom_classe,
  niveau_code,
  cycle,
  serie_code,
  trimestre,
  annee_scolaire,
  -- Calcul de la moyenne générale pondérée par les coefficients des matières
  CASE 
    WHEN SUM(coefficient) > 0 THEN 
      ROUND(SUM(moyenne_matiere * coefficient) / SUM(coefficient), 2)
    ELSE 0 
  END as moyenne_generale,
  -- Détermination de la mention selon le barème sénégalais
  CASE 
    WHEN SUM(coefficient) > 0 THEN 
      CASE 
        WHEN ROUND(SUM(moyenne_matiere * coefficient) / SUM(coefficient), 2) < 10 THEN 'Insuffisant'
        WHEN ROUND(SUM(moyenne_matiere * coefficient) / SUM(coefficient), 2) < 12 THEN 'Passable'
        WHEN ROUND(SUM(moyenne_matiere * coefficient) / SUM(coefficient), 2) < 14 THEN 'Assez bien'
        WHEN ROUND(SUM(moyenne_matiere * coefficient) / SUM(coefficient), 2) < 16 THEN 'Bien'
        ELSE 'Très bien'
      END
    ELSE 'Insuffisant'
  END as mention,
  COUNT(*) as nombre_matieres,
  SUM(coefficient) as total_coefficients
FROM public.v_moyennes_matieres
WHERE moyenne_matiere > 0 -- Exclure les matières sans notes
GROUP BY eleve_id, prenom, nom, matricule, classe_id, nom_classe, 
         niveau_code, cycle, serie_code, trimestre, annee_scolaire;

-- Vue optimisée pour les bulletins complets avec adaptation par cycle
CREATE OR REPLACE VIEW public.v_bulletins_complets WITH (security_invoker = true) AS
WITH matieres_stats AS (
  -- Sous-requête pour calculer les moyennes par matière pour chaque élève/trimestre
  SELECT 
    e.id as eleve_id,
    c.id as classe_id,
    ev.trimestre,
    ev.annee_scolaire,
    m.id as matiere_id,
    m.nom as matiere_nom,
    COALESCE(cm.coefficient, 1) as coefficient,
    CASE 
      WHEN COUNT(notes.id) > 0 THEN 
        ROUND(SUM(notes.note * ev.coef) / SUM(ev.coef), 2)
      ELSE 0 
    END as moyenne_matiere,
    COUNT(notes.id) as nombre_notes
  FROM public.eleves e
  JOIN public.classes c ON e.classe_id = c.id
  JOIN public.niveaux niv ON c.niveau_id = niv.id
  LEFT JOIN public.series s ON c.serie_id = s.id
  JOIN public.evaluations ev ON ev.classe_id = c.id
  JOIN public.matieres m ON ev.matiere_id = m.id
  JOIN public.coefficients_matieres cm ON cm.matiere_id = m.id AND cm.niveau_id = niv.id 
    AND (cm.serie_id = s.id OR (cm.serie_id IS NULL AND s.id IS NULL))
  LEFT JOIN public.notes notes ON notes.evaluation_id = ev.id AND notes.eleve_id = e.id
  GROUP BY e.id, c.id, ev.trimestre, ev.annee_scolaire, m.id, m.nom, cm.coefficient
)
SELECT 
  e.id as eleve_id,
  e.prenom,
  e.nom,
  e.matricule,
  c.id as classe_id,
  c.nom_classe,
  niv.code as niveau_code,
  niv.nom as niveau_nom,
  niv.cycle,
  COALESCE(s.code, '') as serie_code,
  COALESCE(s.nom, '') as serie_nom,
  ms.trimestre,
  ms.annee_scolaire,
  -- Détails des matières en format JSON
  jsonb_agg(
    jsonb_build_object(
      'id', ms.matiere_id,
      'nom', ms.matiere_nom,
      'coefficient', ms.coefficient,
      'moyenne', ms.moyenne_matiere,
      'notes_count', ms.nombre_notes
    ) ORDER BY ms.matiere_nom
  ) as matieres_details_json,
  -- Moyenne Générale
  ROUND(SUM(ms.moyenne_matiere * ms.coefficient) / NULLIF(SUM(ms.coefficient), 0), 2) as moyenne_generale,
  -- Mention
  CASE 
    WHEN SUM(ms.coefficient) > 0 THEN 
      CASE 
        WHEN ROUND(SUM(ms.moyenne_matiere * ms.coefficient) / SUM(ms.coefficient), 2) < 10 THEN 'Insuffisant'
        WHEN ROUND(SUM(ms.moyenne_matiere * ms.coefficient) / SUM(ms.coefficient), 2) < 12 THEN 'Passable'
        WHEN ROUND(SUM(ms.moyenne_matiere * ms.coefficient) / SUM(ms.coefficient), 2) < 14 THEN 'Assez bien'
        WHEN ROUND(SUM(ms.moyenne_matiere * ms.coefficient) / SUM(ms.coefficient), 2) < 16 THEN 'Bien'
        ELSE 'Très bien'
      END
    ELSE 'Insuffisant'
  END as mention,
  COUNT(DISTINCT ms.matiere_id) as nombre_matieres,
  SUM(ms.coefficient) as total_coefficients
FROM public.eleves e
JOIN public.classes c ON e.classe_id = c.id
JOIN public.niveaux niv ON c.niveau_id = niv.id
LEFT JOIN public.series s ON c.serie_id = s.id
JOIN matieres_stats ms ON ms.eleve_id = e.id AND ms.classe_id = c.id
GROUP BY e.id, e.prenom, e.nom, e.matricule, c.id, c.nom_classe, 
         niv.id, niv.code, niv.nom, niv.cycle, s.code, s.nom, ms.trimestre, ms.annee_scolaire
ORDER BY e.nom, e.prenom, ms.trimestre;

-- Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
