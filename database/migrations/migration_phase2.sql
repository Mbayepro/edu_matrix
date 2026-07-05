-- ============================================================
-- EDUMATRIX - Migration Phase 2
-- Ajout des colonnes pour le Mode Enseignement et la Gamification
-- ============================================================

-- 1. Ajout des observations individuelles dans les présences
ALTER TABLE public.presences 
ADD COLUMN IF NOT EXISTS observation TEXT;

-- 2. Ajout des points de mérite pour la gamification
ALTER TABLE public.eleves 
ADD COLUMN IF NOT EXISTS points_merite INTEGER DEFAULT 0;

-- 3. Ajout d'une table pour les rapports journaliers archivés (Optionnel mais recommandé)
CREATE TABLE IF NOT EXISTS public.rapports_journaliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecole_id    UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  stats       JSONB NOT NULL, -- { presence_rate: 0.95, nb_emargements: 10, total_paiements: 50000 }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ecole_id, date)
);

-- RLS pour la nouvelle table
ALTER TABLE public.rapports_journaliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directeurs peuvent voir les rapports de leur école"
ON public.rapports_journaliers FOR SELECT
TO authenticated
USING (ecole_id = (SELECT ecole_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Directeurs peuvent créer les rapports de leur école"
ON public.rapports_journaliers FOR INSERT
TO authenticated
WITH CHECK (ecole_id = (SELECT ecole_id FROM public.profiles WHERE user_id = auth.uid()));

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_rapports_date ON public.rapports_journaliers(date);
CREATE INDEX IF NOT EXISTS idx_rapports_ecole_id ON public.rapports_journaliers(ecole_id);
