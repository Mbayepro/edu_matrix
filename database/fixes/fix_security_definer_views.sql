-- Correction du Security Linter (SECURITY DEFINER VIEW)
-- Voir: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

-- 1. v_moyennes_matieres
ALTER VIEW public.v_moyennes_matieres SET (security_invoker = on);

-- 2. v_bulletins_complets
ALTER VIEW public.v_bulletins_complets SET (security_invoker = on);

-- 3. v_moyennes_generales
ALTER VIEW public.v_moyennes_generales SET (security_invoker = on);
