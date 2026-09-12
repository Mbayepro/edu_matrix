-- Migration: Configuration des seuils pédagogiques

ALTER TABLE public.ecoles ADD COLUMN IF NOT EXISTS seuil_passage_secondaire NUMERIC DEFAULT 10;
ALTER TABLE public.ecoles ADD COLUMN IF NOT EXISTS seuil_redoublement_secondaire NUMERIC DEFAULT 8.5;
ALTER TABLE public.ecoles ADD COLUMN IF NOT EXISTS seuil_passage_primaire NUMERIC DEFAULT 5;
ALTER TABLE public.ecoles ADD COLUMN IF NOT EXISTS seuil_redoublement_primaire NUMERIC DEFAULT 4;
ALTER TABLE public.ecoles ADD COLUMN IF NOT EXISTS seuil_alerte_chute NUMERIC DEFAULT 2;
ALTER TABLE public.ecoles ADD COLUMN IF NOT EXISTS seuil_alerte_absences INTEGER DEFAULT 5;
