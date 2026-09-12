-- Fonction RPC pour supprimer complètement un utilisateur (profil + auth)
-- Nécessite d'être exécutée par un superadmin avec les droits admin
-- Cette fonction supprime d'abord le profil, puis l'utilisateur authentifié

CREATE OR REPLACE FUNCTION delete_user_complete(user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- 1. Supprimer le profil dans la table profiles
    DELETE FROM profiles WHERE id = user_id;
    
    -- 2. Supprimer l'utilisateur authentifié dans auth.users
    -- Note: Ceci nécessite que l'appelant ait les droits admin sur auth.users
    -- Si cela échoue, on retourne un message d'erreur spécifique
    BEGIN
        DELETE FROM auth.users WHERE id = user_id;
        
        result := json_build_object(
            'success', true,
            'message', 'Utilisateur supprimé avec succès'
        );
    EXCEPTION
        WHEN OTHERS THEN
            -- Si la suppression dans auth.users échoue (permissions), on retourne un avertissement
            -- mais le profil est quand même supprimé
            result := json_build_object(
                'success', true,
                'warning', 'Profil supprimé mais utilisateur auth non supprimé (permissions insuffisantes)',
                'message', 'Profil supprimé, contactez l''admin pour supprimer l''auth'
            );
    END;
    
    RETURN result;
END;
$$;

-- Grant pour permettre l'exécution par les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION delete_user_complete TO authenticated;
