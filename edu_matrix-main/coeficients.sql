-- Cette table va donner les "règles du jeu" à ton système
-- Améliorée pour gérer tous les niveaux du Sénégal (CI à Terminale)
CREATE TABLE IF NOT EXISTS public.coefficients_niveaux (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ecole_id UUID REFERENCES public.ecoles(id) ON DELETE CASCADE,
    niveau TEXT NOT NULL, -- Doit correspondre exactement aux valeurs de ta table 'classes' (ex: "CM2", "3eme", "Tle L1")
    matiere_id UUID REFERENCES public.matieres(id) ON DELETE CASCADE, -- Jointure avec la table matières
    matiere_nom TEXT NOT NULL, -- Gardé pour compatibilité et recherche rapide
    coefficient INTEGER NOT NULL DEFAULT 1,
    serie TEXT, -- Pour le secondaire: S1, S2, L1, L2, G, T (NULL pour primaire/moyen)
    serie_id UUID REFERENCES public.series(id) ON DELETE SET NULL, -- Foreign key vers la table series
    UNIQUE(ecole_id, niveau, matiere_id, serie_id)
);

-- Index pour accélérer le calcul des bulletins
CREATE INDEX IF NOT EXISTS idx_coeffs_niveau ON public.coefficients_niveaux(niveau);
CREATE INDEX IF NOT EXISTS idx_coeffs_matiere ON public.coefficients_niveaux(matiere_id);
CREATE INDEX IF NOT EXISTS idx_coeffs_ecole ON public.coefficients_niveaux(ecole_id);
CREATE INDEX IF NOT EXISTS idx_coeffs_serie ON public.coefficients_niveaux(serie);

-- On ajoute la colonne si elle n'existe pas
ALTER TABLE public.coefficients_niveaux 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- On crée la fonction qui met à jour la date automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- On supprime l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS update_coefficients_updated_at ON public.coefficients_niveaux;

-- On attache le trigger à la table
CREATE TRIGGER update_coefficients_updated_at
BEFORE UPDATE ON public.coefficients_niveaux
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- On active la sécurité sur la table
ALTER TABLE public.coefficients_niveaux ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Lecture des coefficients par école" ON public.coefficients_niveaux;
DROP POLICY IF EXISTS "Gestion des coefficients par le directeur" ON public.coefficients_niveaux;

-- Règle 1 : Tout le personnel d'une école peut voir les coefficients de son école
CREATE POLICY "Lecture des coefficients par école"
ON public.coefficients_niveaux
FOR SELECT
TO authenticated
USING (
    ecole_id IN (
        SELECT ecole_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- Règle 2 : Seul le Directeur peut insérer/modifier/supprimer
CREATE POLICY "Gestion des coefficients par le directeur"
ON public.coefficients_niveaux
FOR ALL -- Couvre INSERT, UPDATE, DELETE
TO authenticated
USING (
    ecole_id IN (
        SELECT ecole_id FROM public.profiles WHERE id = auth.uid() AND role = 'director'
    )
)
WITH CHECK (
    ecole_id IN (
        SELECT ecole_id FROM public.profiles WHERE id = auth.uid() AND role = 'director'
    )
);

-- ============================================================
-- VUE POUR LE CALCUL DES MOYENNES AVEC COEFFICIENTS
-- ============================================================

DROP VIEW IF EXISTS public.v_moyennes_generales CASCADE;
DROP VIEW IF EXISTS public.v_moyennes_coefficients CASCADE;

-- Vue qui fait la jointure entre notes, coefficients et calcul les moyennes
CREATE OR REPLACE VIEW public.v_moyennes_coefficients AS
SELECT 
    e.id as eleve_id,
    e.nom as eleve_nom,
    e.prenom as eleve_prenom,
    c.id as classe_id,
    c.nom_classe,
    c.niveau as niveau_classe,
    m.id as matiere_id,
    m.nom as matiere_nom,
    cn.coefficient,
    -- Calcul de la moyenne par matière avec coefficients
    ROUND(AVG(n.note), 2) as moyenne_matiere,
    -- Moyenne pondérée par le coefficient
    ROUND(AVG(n.note) * cn.coefficient, 2) as moyenne_ponderee,
    COUNT(n.id) as nombre_notes,
    ev.trimestre
FROM public.eleves e
JOIN public.classes c ON e.classe_id = c.id
JOIN public.notes n ON n.eleve_id = e.id
JOIN public.evaluations ev ON n.evaluation_id = ev.id
JOIN public.matieres m ON ev.matiere_id = m.id
LEFT JOIN public.coefficients_niveaux cn ON 
    cn.niveau = c.niveau 
    AND (cn.matiere_id = m.id OR cn.matiere_nom = m.nom)
    AND cn.ecole_id = e.ecole_id
WHERE e.ecole_id IS NOT NULL
GROUP BY e.id, e.nom, e.prenom, c.id, c.nom_classe, c.niveau, 
         m.id, m.nom, cn.coefficient, ev.trimestre
ORDER BY e.nom, e.prenom, m.nom;

-- Vue pour les moyennes générales par élève
CREATE OR REPLACE VIEW public.v_moyennes_generales AS
SELECT 
    eleve_id,
    eleve_nom,
    eleve_prenom,
    classe_id,
    nom_classe,
    niveau_classe,
    trimestre,
    -- Calcul de la moyenne générale pondérée
    CASE 
        WHEN SUM(coefficient) > 0 THEN
            ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2)
        ELSE 0
    END as moyenne_generale,
    -- Mention selon le barème sénégalais
    CASE 
        WHEN SUM(coefficient) > 0 THEN
            CASE 
                WHEN ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2) < 10 THEN 'Insuffisant'
                WHEN ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2) < 12 THEN 'Passable'
                WHEN ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2) < 14 THEN 'Assez bien'
                WHEN ROUND(SUM(moyenne_ponderee) / SUM(coefficient), 2) < 16 THEN 'Bien'
                ELSE 'Très bien'
            END
        ELSE 'Insuffisant'
    END as mention,
    SUM(coefficient) as total_coefficients,
    COUNT(*) as nombre_matieres
FROM public.v_moyennes_coefficients
WHERE moyenne_matiere > 0 -- Exclure les matières sans notes
GROUP BY eleve_id, eleve_nom, eleve_prenom, classe_id, nom_classe, 
         niveau_classe, trimestre
ORDER BY eleve_nom, eleve_prenom, trimestre;

-- Recharger le cache du schéma PostgREST
NOTIFY pgrst, 'reload schema';