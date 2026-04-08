-- ============================================================
-- FIX: Ajouter pin_parent aux vues de bulletins
-- ============================================================

DROP VIEW IF EXISTS public.v_bulletins_complets CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_generales CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_matieres CASCADE;

CREATE OR REPLACE VIEW public.v_moyennes_matieres AS
WITH raw_notes AS (
  SELECT 
    e.id as eleve_id,
    e.ecole_id,
    e.prenom,
    e.nom,
    e.matricule,
    e.pin_parent,
    e.classe_id,
    m.id as matiere_id,
    m.nom as matiere_nom,
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
    trimestre,
    annee_scolaire,
    AVG(note / bareme * 20) FILTER (WHERE type IN ('controle', 'devoir')) as mcc,
    MAX(note / bareme * 20) FILTER (WHERE type = 'composition') as composition_note,
    COUNT(note) as total_evals,
    MAX(est_bonus::int)::boolean as est_bonus
  FROM raw_notes
  GROUP BY eleve_id, matiere_id, matiere_nom, trimestre, annee_scolaire
)
SELECT 
  e.id as eleve_id,
  e.ecole_id,
  e.prenom,
  e.nom,
  e.matricule,
  e.pin_parent,
  c.id as classe_id,
  c.nom_classe,
  niv.id as niveau_id,
  niv.code as niveau_code,
  COALESCE(niv.cycle, 'primaire') as cycle,
  COALESCE(s.code, '') as serie_code,
  m.id as matiere_id,
  m.nom as matiere_nom,
  sc.trimestre,
  sc.annee_scolaire,
  COALESCE(cm.coefficient, 1) as coefficient,
  sc.mcc,
  sc.composition_note,
  sc.est_bonus,
  -- Règle Sénégal (primaire/moyen/secondaire) : (Moyenne CC + Composition) / 2
  CASE 
    WHEN sc.composition_note IS NULL THEN ROUND(sc.mcc::numeric, 2)
    WHEN sc.mcc IS NULL THEN ROUND(sc.composition_note::numeric, 2)
    ELSE ROUND(((sc.mcc + sc.composition_note) / 2)::numeric, 2)
  END as moyenne_matiere,
  sc.total_evals as nombre_evaluations
FROM public.eleves e
JOIN public.classes c ON e.classe_id = c.id
LEFT JOIN public.niveaux niv ON c.niveau_id = niv.id
LEFT JOIN public.series s ON c.serie_id = s.id
JOIN subject_components sc ON sc.eleve_id = e.id
JOIN public.matieres m ON sc.matiere_id = m.id
LEFT JOIN public.coefficients_matieres cm ON 
  cm.matiere_id = m.id AND 
  cm.niveau_id = niv.id AND 
  (cm.serie_id = s.id OR (cm.serie_id IS NULL AND s.id IS NULL));


CREATE OR REPLACE VIEW public.v_moyennes_generales AS
SELECT 
  eleve_id,
  ecole_id,
  prenom,
  nom,
  matricule,
  pin_parent,
  classe_id,
  nom_classe,
  niveau_code,
  cycle,
  trimestre,
  annee_scolaire,
  SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END) as total_points,
  CASE 
    WHEN SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) > 0 THEN 
      ROUND((
        SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
        / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)
      )::numeric, 2)
    ELSE 0 
  END as moyenne_generale,
  CASE 
    WHEN SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END) > 0 THEN 
      CASE 
        WHEN cycle = 'primaire' THEN
          CASE 
            WHEN (SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
                  / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 5 THEN 'Insuffisant'
            WHEN (SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
                  / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 6 THEN 'Passable'
            WHEN (SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
                  / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 7 THEN 'Assez bien'
            WHEN (SUM(CASE WHEN est_bonus THEN GREATEST(0, (COALESCE(moyenne_matiere, 0) - 10) * coefficient) ELSE COALESCE(moyenne_matiere, 0) * coefficient END)
                  / SUM(CASE WHEN NOT est_bonus AND moyenne_matiere IS NOT NULL THEN coefficient ELSE 0 END)) < 8 THEN 'Bien'
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
GROUP BY eleve_id, ecole_id, prenom, nom, matricule, pin_parent, classe_id, nom_classe, 
         niveau_code, cycle, trimestre, annee_scolaire;


CREATE OR REPLACE VIEW public.v_bulletins_complets AS
SELECT 
  vmg.*,
  ni.nom as niveau_nom,
  COALESCE(ni.cycle, 'primaire') as niveau_cycle,
  (SELECT json_agg(
    json_build_object(
      'id', vmm.matiere_id,
      'nom', vmm.matiere_nom,
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