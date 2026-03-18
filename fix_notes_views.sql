-- ============================================================
-- FIX: Create missing tables and views for averages
-- ============================================================

-- 1. Vue pour les moyennes par matière et par élève
CREATE OR REPLACE VIEW public.v_moyennes_matieres AS
SELECT 
  e.id as eleve_id,
  e.ecole_id,
  e.prenom,
  e.nom,
  e.matricule,
  c.id as classe_id,
  c.nom_classe,
  c.niveau as niveau_code,
  'primaire' as cycle, -- Fallback si pas de niveaux
  '' as serie_code,
  m.id as matiere_id,
  m.nom as matiere_nom,
  ev.trimestre,
  COALESCE(cn.coefficient, m.coefficient, 1) as coefficient,
  -- Calcul de la moyenne pondérée par les coefficients des évaluations (en ramenant la note sur 20)
  CASE 
    WHEN SUM(ev.coef) > 0 THEN 
      ROUND(SUM((notes.note / ev.bareme * 20) * ev.coef) / SUM(ev.coef), 2)
    ELSE 0 
  END as moyenne_matiere,
  COUNT(notes.id) as nombre_evaluations,
  MIN(ev.date) as premiere_evaluation,
  MAX(ev.date) as derniere_evaluation
FROM public.eleves e
JOIN public.classes c ON e.classe_id = c.id
JOIN public.evaluations ev ON ev.classe_id = c.id
JOIN public.matieres m ON ev.matiere_id = m.id
LEFT JOIN public.coefficients_niveaux cn ON 
  cn.matiere_id = m.id AND 
  cn.niveau = c.niveau AND
  cn.ecole_id = e.ecole_id
LEFT JOIN public.notes notes ON 
  notes.evaluation_id = ev.id AND 
  notes.eleve_id = e.id
WHERE e.created_at IS NOT NULL
GROUP BY e.id, e.ecole_id, e.prenom, e.nom, e.matricule, c.id, c.nom_classe, 
         c.niveau, m.id, m.nom, ev.trimestre, cn.coefficient, m.coefficient;

-- 2. Vue pour les moyennes générales
CREATE OR REPLACE VIEW public.v_moyennes_generales AS
SELECT 
  eleve_id,
  ecole_id,
  prenom,
  nom,
  matricule,
  classe_id,
  nom_classe,
  niveau_code,
  cycle,
  serie_code,
  trimestre,
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
GROUP BY eleve_id, ecole_id, prenom, nom, matricule, classe_id, nom_classe, 
         niveau_code, cycle, serie_code, trimestre;

-- 3. Reload cache to fix 400 Bad Request on notes and 404 on views
NOTIFY pgrst, 'reload schema';
