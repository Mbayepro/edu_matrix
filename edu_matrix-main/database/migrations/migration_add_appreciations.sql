-- Création de la table pour stocker les appréciations trimestrielles personnalisées (générées par IA ou saisies manuellement)
CREATE TABLE IF NOT EXISTS public.appreciations_trimestrielles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ecole_id UUID NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
    eleve_id UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
    matiere_id UUID NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
    trimestre INTEGER NOT NULL,
    annee_scolaire TEXT NOT NULL,
    appreciation TEXT,
    professeur_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(eleve_id, matiere_id, trimestre, annee_scolaire)
);

-- Activation de RLS
ALTER TABLE public.appreciations_trimestrielles ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (Identique aux notes, basé sur l'école_id)
CREATE POLICY "Les utilisateurs peuvent voir les appréciations de leur école"
ON public.appreciations_trimestrielles FOR SELECT
USING (ecole_id IN (
  SELECT e.id FROM public.ecoles e
  WHERE e.id = appreciations_trimestrielles.ecole_id
));

CREATE POLICY "Les utilisateurs peuvent insérer des appréciations pour leur école"
ON public.appreciations_trimestrielles FOR INSERT
WITH CHECK (ecole_id IN (
  SELECT e.id FROM public.ecoles e
  WHERE e.id = appreciations_trimestrielles.ecole_id
));

CREATE POLICY "Les utilisateurs peuvent modifier les appréciations de leur école"
ON public.appreciations_trimestrielles FOR UPDATE
USING (ecole_id IN (
  SELECT e.id FROM public.ecoles e
  WHERE e.id = appreciations_trimestrielles.ecole_id
));

CREATE POLICY "Les utilisateurs peuvent supprimer les appréciations de leur école"
ON public.appreciations_trimestrielles FOR DELETE
USING (ecole_id IN (
  SELECT e.id FROM public.ecoles e
  WHERE e.id = appreciations_trimestrielles.ecole_id
));
