-- Fix the missing relationship between coefficients_niveaux and series
ALTER TABLE public.coefficients_niveaux ADD COLUMN IF NOT EXISTS serie_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'coefficients_niveaux_serie_id_fkey'
        AND table_name = 'coefficients_niveaux'
    ) THEN
        ALTER TABLE public.coefficients_niveaux 
        ADD CONSTRAINT coefficients_niveaux_serie_id_fkey 
        FOREIGN KEY (serie_id) REFERENCES public.series(id) ON DELETE SET NULL;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
