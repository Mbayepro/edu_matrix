-- Recalculer l'année scolaire de toutes les évaluations en fonction de leur date de création
UPDATE public.evaluations 
SET annee_scolaire = 
  CASE 
    WHEN EXTRACT(MONTH FROM created_at) >= 9 THEN 
      EXTRACT(YEAR FROM created_at) || '-' || (EXTRACT(YEAR FROM created_at) + 1)
    ELSE 
      (EXTRACT(YEAR FROM created_at) - 1) || '-' || EXTRACT(YEAR FROM created_at)
  END::TEXT;

-- Faire de même pour les notes pour garantir une cohérence parfaite
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS annee_scolaire TEXT;

UPDATE public.notes 
SET annee_scolaire = 
  CASE 
    WHEN EXTRACT(MONTH FROM created_at) >= 9 THEN 
      EXTRACT(YEAR FROM created_at) || '-' || (EXTRACT(YEAR FROM created_at) + 1)
    ELSE 
      (EXTRACT(YEAR FROM created_at) - 1) || '-' || EXTRACT(YEAR FROM created_at)
  END::TEXT;
