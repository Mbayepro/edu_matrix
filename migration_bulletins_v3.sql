-- ============================================================
-- EDUMATRIX - MIGRATION SYSTEME SCOLAIRE SENEGALAIS V3 (FIX SCHEMA & JOINS)
-- ============================================================

-- Nettoyage des anciennes versions pour éviter les erreurs de changement de structure (Postgres 42P16)
DROP VIEW IF EXISTS public.v_bulletins_complets CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_generales CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_matieres CASCADE;

-- 0. Mise à jour du schéma (si nécessaire)
ALTER TABLE public.matieres ADD COLUMN IF NOT EXISTS est_bonus BOOLEAN DEFAULT FALSE;
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS annee_scolaire TEXT DEFAULT '2024-2025';

-- 1. Vue pour les moyennes par matière avec logique MCC + Composition
CREATE OR REPLACE VIEW public.v_moyennes_matieres AS
WITH raw_notes AS (
  SELECT 
    e.id as eleve_id,
    m.id as matiere_id,
    ev.trimestre,
    ev.annee_scolaire,
    ev.type,
    notes.note,
    ev.bareme,
    ev.coef
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
    trimestre,
    annee_scolaire,
    AVG(note / bareme * 20) FILTER (WHERE type IN ('controle', 'devoir')) as mcc,
    MAX(note / bareme * 20) FILTER (WHERE type = 'composition') as composition_note,
    COUNT(note) as total_evals
  FROM raw_notes
  GROUP BY eleve_id, matiere_id, trimestre, annee_scolaire
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
  m.est_bonus,
  sc.trimestre,
  sc.annee_scolaire,
  -- Coeff : cn.coefficient > m.coefficient > default 1
  COALESCE(cn.coefficient, m.coefficient, 1) as coefficient,
  -- Logique Sénégalaise : (MCC + Composition) / 2
  CASE 
    WHEN sc.mcc IS NOT NULL AND sc.composition_note IS NOT NULL THEN ROUND((sc.mcc + sc.composition_note) / 2, 2)
    WHEN sc.mcc IS NOT NULL THEN ROUND(sc.mcc, 2)
    WHEN sc.composition_note IS NOT NULL THEN ROUND(sc.composition_note, 2)
    ELSE NULL
  END as moyenne_matiere,
  sc.total_evals as nombre_evaluations
FROM public.eleves e
JOIN public.classes c ON e.classe_id = c.id
-- Jointure par CODE car 'niveau' dans classes est du TEXTE
LEFT JOIN public.niveaux niv ON niv.code = c.niveau AND niv.ecole_id = e.ecole_id
CROSS JOIN (SELECT id, nom, est_bonus, coefficient FROM public.matieres) m
JOIN subject_components sc ON sc.eleve_id = e.id AND sc.matiere_id = m.id
-- Utilisation de coefficients_niveaux confirmée par l'utilisateur
LEFT JOIN public.coefficients_niveaux cn ON 
  cn.matiere_id = m.id AND 
  cn.niveau = c.niveau AND
  cn.ecole_id = e.ecole_id
WHERE e.created_at IS NOT NULL;

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
  trimestre,
  annee_scolaire,
  -- Points totaux (Bonus EPS inclus)
  SUM(
    CASE 
      WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient)
      ELSE COALESCE(moyenne_matiere, 0) * coefficient 
    END
  ) as total_points,
  -- Diviseur des coefficients (Sans bonus)
  SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) as total_coefficients,
  -- Moyenne Générale
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
  -- Mention
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

-- 3. Vue des bulletins complets
CREATE OR REPLACE VIEW public.v_bulletins_complets AS
SELECT 
  vmg.*,
  ni.nom as niveau_nom,
  COALESCE(ni.cycle, 'primaire') as niveau_cycle,
  (SELECT array_agg(
    '(' || vmm.matiere_id || ',' || vmm.matiere_nom || ',' || vmm.coefficient || ',' || COALESCE(vmm.moyenne_matiere::text, '0') || ',' || vmm.nombre_evaluations || ')'
   )
   FROM public.v_moyennes_matieres vmm
   WHERE vmm.eleve_id = vmg.eleve_id AND vmm.trimestre = vmg.trimestre AND vmm.annee_scolaire = vmg.annee_scolaire AND vmm.moyenne_matiere IS NOT NULL
  ) as matieres_details
FROM public.v_moyennes_generales vmg
-- Correction de la jointure par CODE pour la vue bulletins
LEFT JOIN public.niveaux ni ON ni.code = vmg.niveau_code AND ni.ecole_id = vmg.ecole_id;

NOTIFY pgrst, 'reload schema';
