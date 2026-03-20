-- ============================================================
-- FIX: Robust Academic Calculations & Bulletins V2
-- ============================================================

-- 1. Redéfinition de la vue des moyennes par matière
-- Normalise toutes les notes sur 20 pour la pondération
CREATE OR REPLACE VIEW public.v_moyennes_matieres AS
SELECT 
  e.id as eleve_id,
  e.ecole_id,
  e.prenom,
  e.nom,
  e.matricule,
  c.id as classe_id,
  c.nom_classe,
  niv.id as niveau_id,
  niv.code as niveau_code,
  COALESCE(niv.cycle, 'primaire') as cycle,
  COALESCE(s.code, '') as serie_code,
  m.id as matiere_id,
  m.nom as matiere_nom,
  ev.trimestre,
  COALESCE(cm.coefficient, 1) as coefficient,
  -- Calcul de la moyenne de la matière (normalisée sur 20)
  CASE 
    WHEN SUM(ev.coef) > 0 THEN 
      ROUND(SUM((notes.note / ev.bareme * 20) * ev.coef) / SUM(ev.coef), 2)
    ELSE NULL -- NULL si aucune note pour cette matière
  END as moyenne_matiere,
  COUNT(notes.id) as nombre_evaluations
FROM public.eleves e
JOIN public.classes c ON e.classe_id = c.id
LEFT JOIN public.niveaux niv ON c.niveau_id = niv.id
LEFT JOIN public.series s ON c.serie_id = s.id
JOIN public.evaluations ev ON ev.classe_id = c.id
JOIN public.matieres m ON ev.matiere_id = m.id
LEFT JOIN public.coefficients_matieres cm ON 
  cm.matiere_id = m.id AND 
  cm.niveau_id = niv.id AND 
  (cm.serie_id = s.id OR (cm.serie_id IS NULL AND s.id IS NULL))
LEFT JOIN public.notes notes ON 
  notes.evaluation_id = ev.id AND 
  notes.eleve_id = e.id
WHERE e.created_at IS NOT NULL
GROUP BY e.id, e.ecole_id, e.prenom, e.nom, e.matricule, c.id, c.nom_classe, 
         niv.id, niv.code, niv.cycle, s.code, m.id, m.nom, ev.trimestre, cm.coefficient;

-- 2. Redéfinition de la vue des moyennes générales
-- Corrige le bug du dénominateur (ne compte que les matières avec notes)
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
  -- Total des coefficients SEULEMENT pour les matières notées
  SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) as total_coefficients_notes,
  -- Moyenne adaptée au cycle (/10 pour primaire, /20 sinon)
  CASE 
    WHEN SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) > 0 THEN
      CASE 
        WHEN cycle = 'primaire' THEN 
          ROUND((SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) / 2, 2)
        ELSE 
          ROUND(SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END), 2)
      END
    ELSE 0 
  END as moyenne_generale,
  -- Mention (adapté au cycle)
  CASE 
    WHEN SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) > 0 THEN
      CASE 
        WHEN cycle = 'primaire' THEN
          CASE 
            WHEN (SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) / 2 < 5 THEN 'Insuffisant'
            WHEN (SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) / 2 < 6 THEN 'Passable'
            WHEN (SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) / 2 < 7 THEN 'Assez bien'
            WHEN (SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) / 2 < 8 THEN 'Bien'
            ELSE 'Très bien'
          END
        ELSE
          CASE 
            WHEN (SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 10 THEN 'Insuffisant'
            WHEN (SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 12 THEN 'Passable'
            WHEN (SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 14 THEN 'Assez bien'
            WHEN (SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 16 THEN 'Bien'
            ELSE 'Très bien'
          END
      END
    ELSE 'Insuffisant'
  END as mention,
  COUNT(matiere_id) FILTER (WHERE moyenne_matiere IS NOT NULL) as nombre_matieres,
  SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) as total_coefficients
FROM public.v_moyennes_matieres
GROUP BY eleve_id, ecole_id, prenom, nom, matricule, classe_id, nom_classe, 
         niveau_code, cycle, serie_code, trimestre;

-- 3. Redéfinition de la vue des bulletins complets (pour le générateur PDF)
CREATE OR REPLACE VIEW public.v_bulletins_complets AS
SELECT 
  vmg.*,
  ni.nom as niveau_nom,
  COALESCE(ni.cycle, 'primaire') as niveau_cycle,
  -- Ancien format TEXT[] pour compatibilité du frontend
  (SELECT array_agg(
    '(' || vmm.matiere_id || ',' || vmm.matiere_nom || ',' || vmm.coefficient || ',' || COALESCE(vmm.moyenne_matiere::text, '0') || ',' || vmm.nombre_evaluations || ')'
   )
   FROM public.v_moyennes_matieres vmm
   WHERE vmm.eleve_id = vmg.eleve_id AND vmm.trimestre = vmg.trimestre AND vmm.moyenne_matiere IS NOT NULL
  ) as matieres_details
FROM public.v_moyennes_generales vmg
LEFT JOIN public.classes cl ON vmg.classe_id = cl.id
LEFT JOIN public.niveaux ni ON cl.niveau_id = ni.id;

-- Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';
