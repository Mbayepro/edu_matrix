-- ==============================================================================
-- Script de migration EduMatrix : Ajout de updated_at et gestion des conflits
-- À exécuter dans l'éditeur SQL de Supabase
-- ==============================================================================

-- 1. Créer une fonction générique pour mettre à jour automatiquement la colonne updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Ajouter la colonne updated_at aux tables principales (si elle n'existe pas déjà)
-- Note: 'created_at' existe généralement déjà par défaut dans Supabase

DO $$ 
DECLARE
    t_name text;
    tables_list text[] := ARRAY['eleves', 'presences', 'paiements', 'notes', 'evaluations', 'eleves_frais', 'emargements', 'classes', 'matieres'];
BEGIN
    FOREACH t_name IN ARRAY tables_list
    LOOP
        -- Ajouter la colonne si elle manque
        EXECUTE format('
            ALTER TABLE IF EXISTS %I 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ', t_name);
        
        -- Créer le trigger s'il n'existe pas
        EXECUTE format('
            DROP TRIGGER IF EXISTS set_updated_at ON %I;
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t_name, t_name);
    END LOOP;
END $$;

-- Vérification
SELECT 'Migration terminée avec succès. Les triggers de conflit de synchronisation sont actifs.' as status;
