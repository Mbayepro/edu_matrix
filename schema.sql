-- ============================================================
-- EDUMATRIX - Complete Database Schema
-- Supabase PostgreSQL
-- ============================================================

-- ─────────────────────────────────────────
-- TABLE: ecoles
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ecoles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           TEXT NOT NULL,
  ville         TEXT NOT NULL,
  telephone     TEXT,
  adresse       TEXT,
  logo_url      TEXT,
  tampon_url    TEXT,
  signature_url TEXT,
  calculation_method TEXT NOT NULL DEFAULT 'BLOCKS' CHECK (calculation_method IN ('BLOCKS', 'WEIGHTED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For existing deployments, make schema.sql idempotent with new columns
ALTER TABLE public.ecoles
  ADD COLUMN IF NOT EXISTS tampon_url    TEXT,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS calculation_method TEXT NOT NULL DEFAULT 'BLOCKS';

-- ─────────────────────────────────────────
-- TABLE: profiles
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ecole_id    UUID REFERENCES public.ecoles(id) ON DELETE SET NULL,
  role        TEXT NOT NULL CHECK (role IN ('superadmin', 'director', 'teacher')),
  nom         TEXT NOT NULL,
  prenom      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─────────────────────────────────────────
-- TABLE: matieres
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matieres (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id   UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  code       TEXT,
  niveau     TEXT, -- Ancien champ, à migrer vers niveaux
  coefficient INTEGER NOT NULL DEFAULT 1, -- Ancien champ, à migrer vers coefficients_matieres
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Nouveaux champs
  cycle      TEXT CHECK (cycle IN ('primaire', 'moyen', 'secondaire')),
  code_matiere TEXT -- Code officiel du ministère
);

-- ─────────────────────────────────────────
-- TABLE: classes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id    UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  nom_classe  TEXT NOT NULL,
  niveau      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: eleves
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eleves (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id        UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  classe_id       UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  matricule       TEXT UNIQUE,
  prenom          TEXT NOT NULL,
  nom             TEXT NOT NULL,
  date_naissance  DATE,
  photo_url       TEXT,
  statut_paiement TEXT NOT NULL DEFAULT 'impayé' CHECK (statut_paiement IN ('payé', 'impayé', 'partiel')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: niveaux
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.niveaux (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id   UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE, -- CI, CP, CE1, CE2, CM1, CM2, 6eme, 5eme, 4eme, 3eme, 2nde, 1ere, Tle
  nom        TEXT NOT NULL, -- Cours Initial, Cours Préparatoire, etc.
  cycle      TEXT NOT NULL CHECK (cycle IN ('primaire', 'moyen', 'secondaire')),
  ordre      INTEGER NOT NULL, -- Pour l'ordre d'affichage
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: series (pour le secondaire)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.series (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id   UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE, -- S1, S2, L1, L2, G, T
  nom        TEXT NOT NULL, -- Scientifique 1, Littéraire 1, etc.
  description TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: coefficients_matieres
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coefficients_matieres (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id      UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  matiere_id    UUID NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  niveau_id     UUID NOT NULL REFERENCES public.niveaux(id) ON DELETE CASCADE,
  serie_id      UUID REFERENCES public.series(id) ON DELETE CASCADE, -- NULL pour primaire/moyen
  coefficient   NUMERIC(4,2) NOT NULL CHECK (coefficient > 0),
  is_obligatoire BOOLEAN NOT NULL DEFAULT TRUE, -- Matière obligatoire ou optionnelle
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(matiere_id, niveau_id, serie_id)
);

-- ─────────────────────────────────────────
-- TABLE: evaluations
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id    UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  classe_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  matiere_id   UUID NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  trimestre    INTEGER NOT NULL CHECK (trimestre IN (1,2,3)),
  type         TEXT NOT NULL CHECK (type IN ('controle', 'devoir', 'composition')),
  date         DATE NOT NULL,
  coef         NUMERIC NOT NULL DEFAULT 1,
  bareme       NUMERIC NOT NULL DEFAULT 20,
  libelle      TEXT, -- 1er Devoir, Devoir 2, etc.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- AJOUT DES COLONNES MANQUANTES AVANT LES CONTRAINTES
-- ─────────────────────────────────────────
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS niveau_id UUID,
  ADD COLUMN IF NOT EXISTS serie_id UUID;

-- ─────────────────────────────────────────
-- AJOUT DES CONTRAINTES FOREIGN KEY
-- ─────────────────────────────────────────
DO $$
BEGIN
    -- Ajouter les contraintes si elles n'existent pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_classes_niveau_id'
    ) THEN
        ALTER TABLE public.classes 
        ADD CONSTRAINT fk_classes_niveau_id 
        FOREIGN KEY (niveau_id) REFERENCES public.niveaux(id) ON DELETE RESTRICT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_classes_serie_id'
    ) THEN
        ALTER TABLE public.classes 
        ADD CONSTRAINT fk_classes_serie_id 
        FOREIGN KEY (serie_id) REFERENCES public.series(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ─────────────────────────────────────────
-- TABLE: notes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id      UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  eleve_id      UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  evaluation_id  UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  professeur_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note          NUMERIC(5,2) NOT NULL CHECK (note >= 0 AND note <= 20),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(eleve_id, evaluation_id)
);

-- ─────────────────────────────────────────
-- TABLE: presences
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.presences (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id  UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  classe_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date      DATE NOT NULL DEFAULT CURRENT_DATE,
  heure     TIME NOT NULL DEFAULT CURRENT_TIME,
  statut    TEXT NOT NULL DEFAULT 'présent' CHECK (statut IN ('présent', 'absent', 'retard')),
  UNIQUE(eleve_id, date)
);

-- ─────────────────────────────────────────
-- TABLE: frais_scolaires
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.frais_scolaires (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id   UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  libelle    TEXT NOT NULL,
  montant    NUMERIC(10,2) NOT NULL,
  frequence  TEXT NOT NULL DEFAULT 'unique' CHECK (frequence IN ('unique', 'mensuel', 'trimestriel')),
  niveau     TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: eleves_frais (montant dû par élève)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eleves_frais (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id        UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  eleve_id        UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  frais_id        UUID NOT NULL REFERENCES public.frais_scolaires(id) ON DELETE CASCADE,
  montant_du      NUMERIC(10,2) NOT NULL,
  montant_remise  NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_a_payer NUMERIC(10,2) GENERATED ALWAYS AS (GREATEST(montant_du - montant_remise, 0)) STORED,
  UNIQUE(eleve_id, frais_id)
);

-- ─────────────────────────────────────────
-- TABLE: paiements
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paiements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id     UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  eleve_id     UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  frais_id     UUID NOT NULL REFERENCES public.frais_scolaires(id) ON DELETE CASCADE,
  montant      NUMERIC(10,2) NOT NULL,
  mode         TEXT,
  reference    TEXT,
  date_paiement TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_user_id    ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_ecole_id   ON public.profiles(ecole_id);
CREATE INDEX IF NOT EXISTS idx_classes_ecole_id    ON public.classes(ecole_id);
CREATE INDEX IF NOT EXISTS idx_classes_niveau_id   ON public.classes(niveau_id);
CREATE INDEX IF NOT EXISTS idx_classes_serie_id    ON public.classes(serie_id);
CREATE INDEX IF NOT EXISTS idx_eleves_ecole_id     ON public.eleves(ecole_id);
CREATE INDEX IF NOT EXISTS idx_eleves_classe_id    ON public.eleves(classe_id);
CREATE INDEX IF NOT EXISTS idx_matieres_ecole_id    ON public.matieres(ecole_id);
CREATE INDEX IF NOT EXISTS idx_matieres_cycle      ON public.matieres(cycle);
CREATE INDEX IF NOT EXISTS idx_niveaux_ecole_id    ON public.niveaux(ecole_id);
CREATE INDEX IF NOT EXISTS idx_niveaux_cycle        ON public.niveaux(cycle);
CREATE INDEX IF NOT EXISTS idx_series_ecole_id     ON public.series(ecole_id);
CREATE INDEX IF NOT EXISTS idx_coefficients_matiere_id ON public.coefficients_matieres(matiere_id);
CREATE INDEX IF NOT EXISTS idx_coefficients_niveau_id  ON public.coefficients_matieres(niveau_id);
CREATE INDEX IF NOT EXISTS idx_coefficients_serie_id   ON public.coefficients_matieres(serie_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_classe_id ON public.evaluations(classe_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_matiere_id ON public.evaluations(matiere_id);
CREATE INDEX IF NOT EXISTS idx_notes_eleve_id      ON public.notes(eleve_id);
CREATE INDEX IF NOT EXISTS idx_notes_evaluation_id  ON public.notes(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_notes_professeur_id  ON public.notes(professeur_id);
CREATE INDEX IF NOT EXISTS idx_presences_eleve_id  ON public.presences(eleve_id);
CREATE INDEX IF NOT EXISTS idx_presences_date      ON public.presences(date);
CREATE INDEX IF NOT EXISTS idx_frais_scolaires_ecole_id ON public.frais_scolaires(ecole_id);
CREATE INDEX IF NOT EXISTS idx_eleves_frais_eleve_id    ON public.eleves_frais(eleve_id);
CREATE INDEX IF NOT EXISTS idx_paiements_eleve_id       ON public.paiements(eleve_id);
CREATE INDEX IF NOT EXISTS idx_paiements_ecole_id       ON public.paiements(ecole_id);

-- ─────────────────────────────────────────
-- VUES SQL pour le calcul des moyennes
-- ─────────────────────────────────────────

-- Vue pour les moyennes par matière et par élève
CREATE OR REPLACE VIEW public.v_moyennes_matieres AS
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
         niv.id, niv.code, niv.cycle, s.code, m.id, m.nom, ev.trimestre, cm.coefficient;

-- Vue pour les moyennes générales
CREATE OR REPLACE VIEW public.v_moyennes_generales AS
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
         niveau_code, cycle, serie_code, trimestre;

-- Vue optimisée pour les bulletins complets avec adaptation par cycle
-- Vue optimisée pour les bulletins complets avec adaptation par cycle
-- Utilise JSON pour une structure de données robuste et facile à consommer en JS
CREATE OR REPLACE VIEW public.v_bulletins_complets AS
WITH matieres_stats AS (
  -- Sous-requête pour calculer les moyennes par matière pour chaque élève/trimestre
  SELECT 
    e.id as eleve_id,
    c.id as classe_id,
    ev.trimestre,
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
  GROUP BY e.id, c.id, ev.trimestre, m.id, m.nom, cm.coefficient
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
  -- Détails des matières en format JSON
  jsonb_agg(
    jsonb_build_object(
      'id', ms.matiere_id,
      'nom', ms.matiere_nom,
      'coefficient', ms.coefficient,
      'moyenne', ms.moyenne_matiere,
      'notes_count', ms.nombre_notes
    ) ORDER BY ms.matiere_nom
  ) as matieres_details,
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
         niv.id, niv.code, niv.nom, niv.cycle, s.code, s.nom, ms.trimestre
ORDER BY e.nom, e.prenom, ms.trimestre;

-- ─────────────────────────────────────────
-- FUNCTION: get_payment_coverage_status
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_payment_coverage_status(p_eleve_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_total_paid    NUMERIC(10,2);
    v_monthly_fee   NUMERIC(10,2);
    v_nb_months     INTEGER;
    v_months        TEXT[] := ARRAY['Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet'];
BEGIN
    SELECT COALESCE(SUM(p.montant), 0) INTO v_total_paid
    FROM public.paiements p
    JOIN public.frais_scolaires f ON p.frais_id = f.id
    WHERE p.eleve_id = p_eleve_id AND f.frequence = 'mensuel';

    SELECT COALESCE(ef.montant_a_payer, 0) INTO v_monthly_fee
    FROM public.eleves_frais ef
    JOIN public.frais_scolaires f ON ef.frais_id = f.id
    WHERE ef.eleve_id = p_eleve_id AND f.frequence = 'mensuel'
    LIMIT 1;

    IF v_monthly_fee <= 0 THEN
        RETURN 'Pas de scolarité mensuelle';
    END IF;

    v_nb_months := FLOOR(v_total_paid / v_monthly_fee);

    IF v_nb_months = 0 THEN
        RETURN 'Impayé (Octobre dû)';
    ELSIF v_nb_months >= 10 THEN
        RETURN 'Scolarité payée pour l/''année';
    ELSE
        RETURN 'Payé (' || v_months[v_nb_months] || ') - OK jusqu/''au 5 ' || v_months[v_nb_months + 1];
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;