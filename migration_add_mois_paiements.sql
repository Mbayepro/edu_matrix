-- Migration : Ajout de la colonne 'mois' à la table 'paiements'
-- Cette colonne permet de suivre pour quel mois un paiement mensuel est effectué.

-- 1. Ajout de la colonne si elle n'existe pas
ALTER TABLE public.paiements 
ADD COLUMN IF NOT EXISTS mois TEXT;

-- 2. (Optionnel) Mise à jour des index pour améliorer les performances des recherches par mois
CREATE INDEX IF NOT EXISTS idx_paiements_mois ON public.paiements(mois);

-- Commentaire : Cette modification est nécessaire pour le fonctionnement correct du tableau de bord des paiements.
COMMENT ON COLUMN public.paiements.mois IS 'Le mois auquel se rapporte le paiement (ex: Janvier, Février, etc.)';
