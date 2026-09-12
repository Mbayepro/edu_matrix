-- Ajout de la colonne type_periode à la table ecoles
ALTER TABLE public.ecoles
  ADD COLUMN IF NOT EXISTS type_periode TEXT NOT NULL DEFAULT 'trimestre' CHECK (type_periode IN ('trimestre', 'semestre'));

-- Recharger le schéma de l'API Supabase pour que les changements soient immédiatement pris en compte
NOTIFY pgrst, 'reload schema';
