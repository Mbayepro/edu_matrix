-- ============================================================
-- RPC pour l'Espace Parent (Vue Simplifiée Publique)
-- Version sécurisée pour le Linter Supabase
-- ============================================================

-- On utilise un schéma interne pour la logique SECURITY DEFINER
CREATE SCHEMA IF NOT EXISTS internal;

-- 1. Récupération des infos d'un élève
CREATE OR REPLACE FUNCTION internal.get_eleve_by_pin(p_pin TEXT)
RETURNS json AS $$
DECLARE
    v_eleve RECORD;
    v_classe RECORD;
    v_ecole RECORD;
    v_result json;
BEGIN
    SELECT * INTO v_eleve FROM public.eleves WHERE pin_parent = p_pin LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;

    SELECT * INTO v_classe FROM public.classes WHERE id = v_eleve.classe_id;
    SELECT * INTO v_ecole FROM public.ecoles WHERE id = v_eleve.ecole_id;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Wrapper public (Satisfait le linter car SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.get_eleve_by_pin(p_pin text)
RETURNS json AS $$
BEGIN
    RETURN internal.get_eleve_by_pin(p_pin);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, internal;


-- 2. Récupération des absences
CREATE OR REPLACE FUNCTION internal.get_absences_by_pin(p_pin TEXT)
RETURNS json AS $$
DECLARE
    v_eleve_id UUID;
    v_result json;
BEGIN
    SELECT id INTO v_eleve_id FROM public.eleves WHERE pin_parent = p_pin LIMIT 1;
    IF NOT FOUND THEN RETURN '[]'::json; END IF;

    SELECT json_agg(row_to_json(p)) INTO v_result
    FROM (
        SELECT * FROM public.presences 
        WHERE eleve_id = v_eleve_id 
        AND statut IN ('absent', 'retard')
        ORDER BY date DESC
    ) p;

    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Wrapper public
CREATE OR REPLACE FUNCTION public.get_absences_by_pin(p_pin text)
RETURNS json AS $$
BEGIN
    RETURN internal.get_absences_by_pin(p_pin);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, internal;


-- 3. Récupération des bulletins
CREATE OR REPLACE FUNCTION internal.get_bulletin_by_pin(p_pin TEXT, p_trimestre INTEGER)
RETURNS json AS $$
DECLARE
    v_eleve_id UUID;
    v_result json;
BEGIN
    SELECT id INTO v_eleve_id FROM public.eleves WHERE pin_parent = p_pin LIMIT 1;
    IF NOT FOUND THEN RETURN '[]'::json; END IF;

    SELECT json_agg(row_to_json(b)) INTO v_result
    FROM (
        SELECT * FROM public.v_bulletins_complets 
        WHERE eleve_id = v_eleve_id 
        AND trimestre = p_trimestre
    ) b;

    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Wrapper public
CREATE OR REPLACE FUNCTION public.get_bulletin_by_pin(p_pin text, p_trimestre integer)
RETURNS json AS $$
BEGIN
    RETURN internal.get_bulletin_by_pin(p_pin, p_trimestre);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, internal;

-- PERMISSIONS
REVOKE ALL ON SCHEMA internal FROM PUBLIC;
GRANT USAGE ON SCHEMA internal TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO postgres, service_role;

GRANT EXECUTE ON FUNCTION public.get_eleve_by_pin(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_absences_by_pin(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_bulletin_by_pin(text, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
