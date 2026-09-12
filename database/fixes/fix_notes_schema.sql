-- ============================================================
-- FIX: Missing ecole_id in notes table & Schema Cache
-- ============================================================

-- 1. Ajouter la colonne ecole_id si elle a été oubliée lors de la création initiale
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS ecole_id UUID REFERENCES public.ecoles(id) ON DELETE CASCADE;

-- 2. Créer l'index si nécessaire
CREATE INDEX IF NOT EXISTS idx_notes_ecole_id ON public.notes(ecole_id);

-- 3. Vider et recharger le cache de schéma de Supabase (PostgREST)
-- C'est ce qui cause l'erreur "Could not find the column in the schema cache"
NOTIFY pgrst, 'reload schema';
