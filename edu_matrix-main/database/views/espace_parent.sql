-- 1. Ajouter le champ pour le PIN Parent à la table eleves
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS pin_parent TEXT UNIQUE;

-- 2. Fonction pour générer un PIN unique de 6 caractères (ex: AB12C3)
CREATE OR REPLACE FUNCTION public.generate_pin() RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER := 0;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 3. Assigner un PIN aux élèves existants qui n'en ont pas
DO $$
DECLARE
    rec RECORD;
    new_pin TEXT;
BEGIN
    FOR rec IN SELECT id FROM public.eleves WHERE pin_parent IS NULL LOOP
        LOOP
            new_pin := public.generate_pin();
            BEGIN
                UPDATE public.eleves SET pin_parent = new_pin WHERE id = rec.id;
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                -- Le PIN généré existe déjà, on recommence
            END;
        END LOOP;
    END LOOP;
END;
$$;

-- 4. Trigger pour générer un PIN automatiquement lors de la création d'un élève
CREATE OR REPLACE FUNCTION public.set_eleve_pin()
RETURNS TRIGGER AS $$
DECLARE
    new_pin TEXT;
BEGIN
    IF NEW.pin_parent IS NULL THEN
        LOOP
            new_pin := public.generate_pin();
            BEGIN
                -- Vérifier si le PIN existe déjà (même si le trigger est BEFORE INSERT, on peut faire un select)
                IF NOT EXISTS (SELECT 1 FROM public.eleves WHERE pin_parent = new_pin) THEN
                    NEW.pin_parent := new_pin;
                    EXIT;
                END IF;
            END;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_eleve_pin ON public.eleves;
CREATE TRIGGER trigger_set_eleve_pin
BEFORE INSERT ON public.eleves
FOR EACH ROW EXECUTE FUNCTION public.set_eleve_pin();

-- Recharger le schéma pour PostgREST
NOTIFY pgrst, 'reload schema';
