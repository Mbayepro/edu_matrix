-- ============================================================
-- EDUMATRIX - MIGRATION V5 : GESTION DES DOMAINES AU PRIMAIRE
-- Remplace le "soft-matching" du frontend par des données strictes
-- ============================================================

-- 1. Ajout de la colonne 'domaine' dans la table matieres
ALTER TABLE public.matieres 
ADD COLUMN IF NOT EXISTS domaine TEXT;

-- 2. Mise à jour des matières existantes (Mapping d'inférence sémantique pour migrer proprement)
UPDATE public.matieres
SET domaine = 
  CASE 
    WHEN lower(nom) LIKE '%lecture%' OR lower(nom) LIKE '%dictée%' OR lower(nom) LIKE '%expression%' OR lower(nom) LIKE '%français%' THEN 'Langue et Communication'
    WHEN lower(nom) LIKE '%math%' OR lower(nom) LIKE '%calcul%' OR lower(nom) LIKE '%géométrie%' THEN 'Mathématiques'
    WHEN lower(nom) LIKE '%science%' OR lower(nom) LIKE '%découverte%' OR lower(nom) LIKE '%histoire%' OR lower(nom) LIKE '%géo%' THEN 'Découverte du Monde'
    WHEN lower(nom) LIKE '%eps%' OR lower(nom) LIKE '%sport%' OR lower(nom) LIKE '%physique%' THEN 'Éducation Physique et Sportive'
    WHEN lower(nom) LIKE '%art%' OR lower(nom) LIKE '%dessin%' OR lower(nom) LIKE '%poésie%' OR lower(nom) LIKE '%chant%' THEN 'Éducation Artistique'
    ELSE 'Activités Diverses'
  END
WHERE domaine IS NULL OR domaine = '';

-- 3. Mise à jour de la vue des moyennes pour inclure le domaine
DROP VIEW IF EXISTS public.v_bulletins_complets CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_generales CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_matieres CASCADE;

CREATE OR REPLACE VIEW public.v_moyennes_matieres WITH (security_invoker = true) AS
WITH raw_notes AS (
  SELECT 
    e.id as eleve_id,
    e.ecole_id,
    m.id as matiere_id,
    m.nom as matiere_nom,
    m.domaine as matiere_domaine,
    ev.trimestre,
    ev.annee_scolaire,
    ev.type,
    notes.note,
    ev.bareme,
    ev.coef,
    m.est_bonus,
    m.cycle as matiere_cycle
  FROM public.eleves e
  JOIN public.evaluations ev ON ev.classe_id = e.classe_id
  JOIN public.matieres m ON ev.matiere_id = m.id
  LEFT JOIN public.notes notes ON notes.evaluation_id = ev.id AND notes.eleve_id = e.id
  WHERE notes.id IS NOT NULL
),
subject_components AS (
  SELECT 
    eleve_id,
    matiere_id,
    matiere_nom,
    matiere_domaine,
    trimestre,
    annee_scolaire,
    -- Notes toujours recalculées sur 20 via la base de données
    AVG(note / bareme * 20) FILTER (WHERE type IN ('controle', 'devoir')) as mcc,
    MAX(note / bareme * 20) FILTER (WHERE type = 'composition') as composition_note,
    COUNT(note) as total_evals,
    MAX(est_bonus::int)::boolean as est_bonus
  FROM raw_notes
  GROUP BY eleve_id, matiere_id, matiere_nom, matiere_domaine, trimestre, annee_scolaire
)
SELECT 
  e.id as eleve_id,
  e.ecole_id,
  e.prenom,
  e.nom,
  e.matricule,
  c.id as classe_id,
  c.nom_classe,
  c.niveau as niveau_code,
  COALESCE(niv.cycle, 'primaire') as cycle,
  m.id as matiere_id,
  m.nom as matiere_nom,
  m.domaine as domaine,
  sc.est_bonus,
  sc.trimestre,
  sc.annee_scolaire,
  COALESCE(cn.coefficient, m.coefficient, 1) as coefficient,
  sc.mcc,
  sc.composition_note,
  CASE 
    WHEN sc.mcc IS NOT NULL AND sc.composition_note IS NOT NULL THEN ROUND((sc.mcc + sc.composition_note) / 2, 2)
    WHEN sc.mcc IS NOT NULL THEN ROUND(sc.mcc, 2)
    WHEN sc.composition_note IS NOT NULL THEN ROUND(sc.composition_note, 2)
    ELSE NULL
  END as moyenne_matiere,
  sc.total_evals as nombre_evaluations
FROM public.eleves e
JOIN public.classes c ON e.classe_id = c.id
LEFT JOIN public.niveaux niv ON niv.code = c.niveau AND niv.ecole_id = e.ecole_id
CROSS JOIN (SELECT id, nom, domaine, est_bonus, coefficient FROM public.matieres) m
JOIN subject_components sc ON sc.eleve_id = e.id AND sc.matiere_id = m.id
LEFT JOIN public.coefficients_niveaux cn ON 
  cn.matiere_id = m.id AND 
  cn.niveau = c.niveau AND
  cn.ecole_id = e.ecole_id
WHERE e.created_at IS NOT NULL;


-- Recréation des vues liées pour ne pas les briser

CREATE OR REPLACE VIEW public.v_moyennes_generales WITH (security_invoker = true) AS
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
  trimestre,
  annee_scolaire,
  SUM(
    CASE 
      WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient)
      ELSE COALESCE(moyenne_matiere, 0) * coefficient 
    END
  ) as total_points,
  SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) as total_coefficients,
  CASE 
    WHEN SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) > 0 THEN
      CASE 
        WHEN cycle = 'primaire' THEN 
           ROUND((SUM(COALESCE(moyenne_matiere, 0) * coefficient) / SUM(CASE WHEN moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) / 2, 2)
        ELSE 
           ROUND(
             SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
             / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END), 2
           )
      END
    ELSE 0 
  END as moyenne_generale,
  CASE 
    WHEN SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) > 0 THEN
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
            WHEN (SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
                  / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 10 THEN 'Insuffisant'
            WHEN (SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
                  / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 12 THEN 'Passable'
            WHEN (SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
                  / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 14 THEN 'Assez bien'
            WHEN (SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
                  / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 16 THEN 'Bien'
            ELSE 'Très bien'
          END
      END
    ELSE 'Insuffisant'
  END as mention,
  COUNT(matiere_id) FILTER (WHERE moyenne_matiere IS NOT NULL) as nombre_matieres,
  SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) as total_coefficients_calcules
FROM public.v_moyennes_matieres
GROUP BY eleve_id, ecole_id, prenom, nom, matricule, classe_id, nom_classe, 
         niveau_code, cycle, trimestre, annee_scolaire;

CREATE OR REPLACE VIEW public.v_bulletins_complets WITH (security_invoker = true) AS
SELECT 
  vmg.*,
  ni.nom as niveau_nom,
  COALESCE(ni.cycle, 'primaire') as niveau_cycle,
  (SELECT json_agg(
    json_build_object(
      'id', vmm.matiere_id,
      'nom', vmm.matiere_nom,
      'domaine', vmm.domaine,  -- Nouvel export du domaine DB !
      'coefficient', vmm.coefficient,
      'mcc', vmm.mcc,
      'composition_note', vmm.composition_note,
      'moyenne', vmm.moyenne_matiere,
      'nombre_evaluations', vmm.nombre_evaluations,
      'est_bonus', vmm.est_bonus
    )
   )
   FROM public.v_moyennes_matieres vmm
   WHERE vmm.eleve_id = vmg.eleve_id AND vmm.trimestre = vmg.trimestre AND vmm.annee_scolaire = vmg.annee_scolaire AND vmm.moyenne_matiere IS NOT NULL
  ) as matieres_details_json,
  ec.nom as ecole_nom,
  ec.logo_url as ecole_logo_url,
  ec.tampon_url as ecole_tampon_url,
  ec.signature_url as ecole_signature_url
FROM public.v_moyennes_generales vmg
LEFT JOIN public.niveaux ni ON ni.code = vmg.niveau_code AND ni.ecole_id = vmg.ecole_id
LEFT JOIN public.ecoles ec ON ec.id = vmg.ecole_id;

NOTIFY pgrst, 'reload schema';
