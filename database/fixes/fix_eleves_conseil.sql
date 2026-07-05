-- Ajout des colonnes pour le Conseil de Classe
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS appreciation_trimestre TEXT;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS decision_conseil TEXT;

-- Recharger le cache du schéma PostgREST
NOTIFY pgrst, 'reload schema';
