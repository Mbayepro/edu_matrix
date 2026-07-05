-- ============================================================
-- FIX: recalculate_statut_paiement function
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_statut_paiement(p_eleve_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_du   NUMERIC(10,2);
  v_total_paye NUMERIC(10,2);
  v_statut     TEXT;
BEGIN
  SELECT COALESCE(SUM(montant_a_payer), 0)
  INTO v_total_du
  FROM public.eleves_frais
  WHERE eleve_id = p_eleve_id;

  SELECT COALESCE(SUM(montant), 0)
  INTO v_total_paye
  FROM public.paiements
  WHERE eleve_id = p_eleve_id;

  IF v_total_paye >= v_total_du AND v_total_du > 0 THEN
    v_statut := 'payé';
  ELSIF v_total_paye > 0 AND v_total_paye < v_total_du THEN
    v_statut := 'partiel';
  ELSIF v_total_paye > 0 AND v_total_du <= 0 THEN
    v_statut := 'payé';
  ELSE
    v_statut := 'impayé';
  END IF;

  UPDATE public.eleves
  SET statut_paiement = v_statut
  WHERE id = p_eleve_id;
END;
$$;

-- Recalculate status for all students immediately
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.eleves LOOP
    PERFORM public.recalculate_statut_paiement(rec.id);
  END LOOP;
END;
$$;
