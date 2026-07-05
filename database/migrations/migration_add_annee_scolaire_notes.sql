-- ============================================================
-- EDUMATRIX - MIGRATION : Ajouter colonne annee_scolaire dans notes
-- Permet de filtrer les notes par année scolaire pour la synchronisation offline
-- ============================================================

-- Ajouter la colonne annee_scolaire à la table notes
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS annee_scolaire TEXT;

-- Mettre à jour les notes existantes avec l'année scolaire actuelle
-- Basé sur la date de création de la note
UPDATE public.notes 
SET annee_scolaire = 
  CASE 
    WHEN EXTRACT(MONTH FROM created_at) >= 9 THEN 
      EXTRACT(YEAR FROM created_at) || '-' || (EXTRACT(YEAR FROM created_at) + 1)
    ELSE 
      (EXTRACT(YEAR FROM created_at) - 1) || '-' || EXTRACT(YEAR FROM created_at)
  END::TEXT
WHERE annee_scolaire IS NULL;

-- Ajouter une contrainte pour s'assurer que les nouvelles notes ont une année scolaire
ALTER TABLE public.notes 
ALTER COLUMN annee_scolaire SET NOT NULL;

-- Ajouter un index pour optimiser les requêtes par année scolaire
CREATE INDEX IF NOT EXISTS idx_notes_annee_scolaire ON public.notes(annee_scolaire);
CREATE INDEX IF NOT EXISTS idx_notes_ecole_annee ON public.notes(ecole_id, annee_scolaire);

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.notes.annee_scolaire IS 'Année scolaire de la note (ex: 2024-2025) pour le filtrage et la synchronisation offline';

NOTIFY pgrst, 'reload schema';
