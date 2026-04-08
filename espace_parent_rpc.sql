-- ============================================================
-- RPC pour l'Espace Parent (Vue Simplifiée Publique)
-- ============================================================

-- Fonction sécurisée pour récupérer les infos d'un élève via son PIN sans exposer la table complète
CREATE OR REPLACE FUNCTION public.get_eleve_by_pin(p_pin TEXT)
RETURNS json AS $$
DECLARE
    v_eleve RECORD;
    v_classe RECORD;
    v_ecole RECORD;
    v_result json;
BEGIN
    -- Chercher l'élève
    SELECT * INTO v_eleve FROM public.eleves WHERE pin_parent = p_pin LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Chercher la classe
    SELECT * INTO v_classe FROM public.classes WHERE id = v_eleve.classe_id;
    
    -- Chercher l'école
    SELECT * INTO v_ecole FROM public.ecoles WHERE id = v_eleve.ecole_id;

    -- Construire l'objet JSON
    v_result := json_build_object(
        'id', v_eleve.id,
        'nom', v_eleve.nom,
        'prenom', v_eleve.prenom,
        'matricule', v_eleve.matricule,
        'classe_id', v_eleve.classe_id,
        'ecole_id', v_eleve.ecole_id,
        'pin_parent', v_eleve.pin_parent,
        'classe', json_build_object(
            'id', v_classe.id,
            'nom_classe', v_classe.nom_classe,
            'ecole', json_build_object(
                'nom', v_ecole.nom,
                'logo_url', v_ecole.logo_url
            )
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fonction sécurisée pour récupérer les absences d'un élève via son PIN
CREATE OR REPLACE FUNCTION public.get_absences_by_pin(p_pin TEXT)
RETURNS json AS $$
DECLARE
    v_eleve_id UUID;
    v_result json;
BEGIN
    SELECT id INTO v_eleve_id FROM public.eleves WHERE pin_parent = p_pin LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN '[]'::json;
    END IF;

    SELECT json_agg(row_to_json(p)) INTO v_result
    FROM (
        SELECT * FROM public.presences 
        WHERE eleve_id = v_eleve_id 
        AND statut IN ('absent', 'retard')
        ORDER BY date DESC
    ) p;

    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fonction sécurisée pour récupérer les bulletins via le PIN
CREATE OR REPLACE FUNCTION public.get_bulletin_by_pin(p_pin TEXT, p_trimestre INTEGER)
RETURNS json AS $$
DECLARE
    v_eleve_id UUID;
    v_result json;
BEGIN
    SELECT id INTO v_eleve_id FROM public.eleves WHERE pin_parent = p_pin LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN '[]'::json;
    END IF;

    SELECT json_agg(row_to_json(b)) INTO v_result
    FROM (
        SELECT * FROM public.v_bulletins_complets 
        WHERE eleve_id = v_eleve_id 
        AND trimestre = p_trimestre
    ) b;

    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recharger le schéma pour PostgREST
NOTIFY pgrst, 'reload schema';
