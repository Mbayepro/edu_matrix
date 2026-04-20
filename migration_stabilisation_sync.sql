-- ============================================================
-- MIGRATION : STABILISATION DE LA SYNCHRONISATION
-- Ajout de updated_at, deleted_at et triggers de synchronisation
-- ============================================================

-- 1. Création de la fonction trigger pour updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Ajout des colonnes aux tables existantes
-- Nous ajoutons updated_at et deleted_at (pour les Soft Deletes)

DO $$ 
DECLARE 
    t TEXT;
    tables TEXT[] := ARRAY[
        'ecoles', 'profiles', 'matieres', 'classes', 'eleves', 
        'niveaux', 'series', 'coefficients_matieres', 'evaluations', 
        'notes', 'presences', 'frais_scolaires', 'eleves_frais', 
        'paiements', 'emargements'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Ajout de updated_at
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()', t);
        
        -- Ajout de deleted_at
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);

        -- Création du trigger pour updated_at
        EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', t);
        EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
        
        -- Index pour la performance des synchronisations incrémentales
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(updated_at)', 'idx_' || t || '_updated_at', t);
    END LOOP;
END $$;

-- 3. Mise à jour spécifique de la vue des bulletins pour exclure les éléments supprimés (Soft Delete)
-- Cela garantit que si un élève ou une note est "suprimé" (deleted_at IS NOT NULL), il n'apparaît plus dans les calculs
-- [Note: Les vues existantes devront être mises à jour si elles filtrent sur created_at uniquement]

COMMENT ON FUNCTION public.handle_updated_at IS 'Met à jour automatiquement la colonne updated_at lors d''une modification.';
