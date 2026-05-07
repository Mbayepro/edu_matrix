-- ============================================================
-- EDUMATRIX - Fix Security Linter Warnings (Part 2)
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX 1: Public Bucket Allows Listing (eleves-photos)
-- ─────────────────────────────────────────────────────────────
-- Revoke broad SELECT on storage.objects for the public bucket to prevent listing.
-- Public buckets allow downloading files via URL without RLS SELECT, 
-- but listing files requires RLS SELECT on storage.objects.
-- We restrict listing to authenticated users only.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'eleves-photos') THEN
        -- Remove the existing broad policy
        DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
        
        -- Re-create it restricted to authenticated users for listing
        CREATE POLICY "Public Read Access" ON storage.objects
          FOR SELECT
          TO authenticated
          USING (bucket_id = 'eleves-photos');
          
        RAISE NOTICE 'Bucket eleves-photos policy updated to restrict listing to authenticated users.';
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- FIX 2: Restrict SECURITY DEFINER functions
-- ─────────────────────────────────────────────────────────────
-- We revoke EXECUTE from PUBLIC (everyone) and grant it specifically
-- to the intended roles. We also set search_path for security.

-- A. Internal Trigger Functions (No API access)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_matricule() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_statut_paiement_trigger() FROM PUBLIC;

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.generate_matricule() SET search_path = public;
ALTER FUNCTION public.recalculate_statut_paiement_trigger() SET search_path = public;

-- B. Business Logic Functions (Authenticated users only)
REVOKE EXECUTE ON FUNCTION public.get_my_ecole_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_ecole_id() TO authenticated;
ALTER FUNCTION public.get_my_ecole_id() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
ALTER FUNCTION public.get_my_role() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.calculate_moyenne_ponderee(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_moyenne_ponderee(uuid, integer) TO authenticated;
ALTER FUNCTION public.calculate_moyenne_ponderee(uuid, integer) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.recalculate_statut_paiement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_statut_paiement(uuid) TO authenticated;
ALTER FUNCTION public.recalculate_statut_paiement(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_payment_coverage_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payment_coverage_status(uuid) TO authenticated;
ALTER FUNCTION public.get_payment_coverage_status(uuid) SET search_path = public;

-- C. Parent Space Functions (Explicitly grant to anon and authenticated)
-- These are intended for public use via PIN, so we grant to 'anon'.
REVOKE EXECUTE ON FUNCTION public.get_eleve_by_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_eleve_by_pin(text) TO anon, authenticated;
ALTER FUNCTION public.get_eleve_by_pin(text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_absences_by_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_absences_by_pin(text) TO anon, authenticated;
ALTER FUNCTION public.get_absences_by_pin(text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_bulletin_by_pin(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bulletin_by_pin(text, integer) TO anon, authenticated;
ALTER FUNCTION public.get_bulletin_by_pin(text, integer) SET search_path = public;

-- ─────────────────────────────────────────────────────────────
-- Finalize
-- ─────────────────────────────────────────────────────────────
-- Reload schema cache
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE 'Security linter fixes applied successfully.';
END $$;
