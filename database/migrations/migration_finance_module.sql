-- ============================================================
-- EDUMATRIX — Migration Module Finance Standalone (v2 — idempotente)
-- Stratégie : CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS
-- Compatible avec les tables existantes partiellement créées
-- ============================================================

-- ─────────────────────────────────────────
-- TABLE: depenses (CREATE ou compléter si existante)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.depenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id     UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  libelle      TEXT NOT NULL,
  montant      NUMERIC(10,2) NOT NULL,
  date_depense DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajout des colonnes manquantes si la table existait déjà sans elles
ALTER TABLE public.depenses
  ADD COLUMN IF NOT EXISTS categorie    TEXT NOT NULL DEFAULT 'autre',
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;

-- Nettoyer les catégories invalides existantes AVANT d'ajouter la contrainte
UPDATE public.depenses
  SET categorie = 'autre'
  WHERE categorie IS NULL
     OR categorie NOT IN ('loyer','electricite','eau','fournitures','materiel','entretien','communication','transport','autre');

-- Contrainte CHECK sur categorie (idempotente via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'depenses_categorie_check'
  ) THEN
    ALTER TABLE public.depenses
      ADD CONSTRAINT depenses_categorie_check
      CHECK (categorie IN ('loyer','electricite','eau','fournitures','materiel','entretien','communication','transport','autre'));
  END IF;
END $$;

-- Contrainte CHECK sur montant (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'depenses_montant_check'
  ) THEN
    ALTER TABLE public.depenses
      ADD CONSTRAINT depenses_montant_check CHECK (montant > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_depenses_ecole_id  ON public.depenses(ecole_id);
CREATE INDEX IF NOT EXISTS idx_depenses_date       ON public.depenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_depenses_categorie  ON public.depenses(categorie);

-- ─────────────────────────────────────────
-- TABLE: paiements_staff
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paiements_staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id        UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  montant         NUMERIC(10,2) NOT NULL,
  mois            TEXT NOT NULL,
  annee_scolaire  TEXT NOT NULL DEFAULT '2024-2025',
  date_paiement   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.paiements_staff
  ADD COLUMN IF NOT EXISTS mode          TEXT DEFAULT 'Espèces',
  ADD COLUMN IF NOT EXISTS reference     TEXT,
  ADD COLUMN IF NOT EXISTS note          TEXT,
  ADD COLUMN IF NOT EXISTS created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_paiements_staff_ecole_id   ON public.paiements_staff(ecole_id);
CREATE INDEX IF NOT EXISTS idx_paiements_staff_profile_id ON public.paiements_staff(profile_id);
CREATE INDEX IF NOT EXISTS idx_paiements_staff_mois        ON public.paiements_staff(mois);

-- ─────────────────────────────────────────
-- COLONNE: solde_credit dans eleves_frais
-- ─────────────────────────────────────────
ALTER TABLE public.eleves_frais
  ADD COLUMN IF NOT EXISTS solde_credit NUMERIC(10,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────
-- RLS: depenses
-- ─────────────────────────────────────────
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "depenses_select_ecole" ON public.depenses;
CREATE POLICY "depenses_select_ecole" ON public.depenses
  FOR SELECT USING (
    ecole_id = (SELECT ecole_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (deleted_at IS NULL OR deleted_at > NOW())
  );

DROP POLICY IF EXISTS "depenses_insert_director" ON public.depenses;
CREATE POLICY "depenses_insert_director" ON public.depenses
  FOR INSERT WITH CHECK (
    ecole_id = (SELECT ecole_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1) IN ('director', 'superadmin')
  );

DROP POLICY IF EXISTS "depenses_update_director" ON public.depenses;
CREATE POLICY "depenses_update_director" ON public.depenses
  FOR UPDATE USING (
    ecole_id = (SELECT ecole_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1) IN ('director', 'superadmin')
  );

DROP POLICY IF EXISTS "depenses_delete_director" ON public.depenses;
CREATE POLICY "depenses_delete_director" ON public.depenses
  FOR DELETE USING (
    ecole_id = (SELECT ecole_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1) IN ('director', 'superadmin')
  );

-- ─────────────────────────────────────────
-- RLS: paiements_staff
-- ─────────────────────────────────────────
ALTER TABLE public.paiements_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paiements_staff_select_ecole" ON public.paiements_staff;
CREATE POLICY "paiements_staff_select_ecole" ON public.paiements_staff
  FOR SELECT USING (
    ecole_id = (SELECT ecole_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "paiements_staff_insert_director" ON public.paiements_staff;
CREATE POLICY "paiements_staff_insert_director" ON public.paiements_staff
  FOR INSERT WITH CHECK (
    ecole_id = (SELECT ecole_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1) IN ('director', 'superadmin')
  );

DROP POLICY IF EXISTS "paiements_staff_update_director" ON public.paiements_staff;
CREATE POLICY "paiements_staff_update_director" ON public.paiements_staff
  FOR UPDATE USING (
    ecole_id = (SELECT ecole_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1) IN ('director', 'superadmin')
  );
