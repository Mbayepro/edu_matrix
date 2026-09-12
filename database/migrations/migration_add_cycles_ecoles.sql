-- Migration : Ajout de cycles_couverts à la table ecoles
-- Objectif : Permettre à chaque école de définir quels cycles elle couvre (Primaire, Moyen, Secondaire)
-- Cela permet de simplifier l'interface (ex: cacher les classes de lycée pour une école primaire).

ALTER TABLE public.ecoles
ADD COLUMN IF NOT EXISTS cycles_couverts text[] DEFAULT ARRAY['primaire'];

-- Commentaire sur la colonne pour la documentation
COMMENT ON COLUMN public.ecoles.cycles_couverts IS 'Tableau contenant les cycles couverts par l''établissement : primaire, moyen, secondaire.';
