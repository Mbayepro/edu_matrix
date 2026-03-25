-- ============================================================
-- FIX Warning: function_search_path_mutable
-- La fonction doit avoir un search_path fixe pour éviter
-- les attaques par injection de schéma (schema injection).
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''          -- search_path vide = sécurisé
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Recharger le cache PostgREST (bonne pratique)
NOTIFY pgrst, 'reload schema';
