-- ============================================================
-- FIX: Update handle_new_user trigger so that:
--   1. Schools are created with statut = 'en_attente'
--   2. Everything runs in SECURITY DEFINER, bypassing RLS
--      (no more client-side insert into ecoles needed)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        TEXT;
  v_nom         TEXT;
  v_prenom      TEXT;
  v_ecole_id    UUID;
  v_nom_ecole   TEXT;
  v_ville_ecole TEXT;
  v_tel_ecole   TEXT;
BEGIN
  -- Read metadata passed at signup
  v_role   := COALESCE(NEW.raw_user_meta_data->>'role',   'teacher');
  v_nom    := COALESCE(NEW.raw_user_meta_data->>'nom',    'Inconnu');
  v_prenom := COALESCE(NEW.raw_user_meta_data->>'prenom', 'Inconnu');

  -- Check if ecole_id is provided directly
  v_ecole_id := (NEW.raw_user_meta_data->>'ecole_id')::UUID;

  -- If no ecole_id but user is director and provides school info, create school
  IF v_ecole_id IS NULL AND v_role = 'director' THEN
    v_nom_ecole   := NEW.raw_user_meta_data->>'nom_ecole';
    v_ville_ecole := NEW.raw_user_meta_data->>'ville_ecole';
    v_tel_ecole   := NEW.raw_user_meta_data->>'telephone_ecole';

    IF v_nom_ecole IS NOT NULL THEN
      INSERT INTO public.ecoles (nom, ville, telephone, statut)
      VALUES (v_nom_ecole, COALESCE(v_ville_ecole, 'Dakar'), v_tel_ecole, 'en_attente')
      RETURNING id INTO v_ecole_id;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, ecole_id, role, nom, prenom)
  VALUES (NEW.id, v_ecole_id, v_role, v_nom, v_prenom)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
