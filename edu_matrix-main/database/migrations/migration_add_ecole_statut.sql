-- ============================================================
-- Migration: Add statut column to ecoles table
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add the statut column
ALTER TABLE public.ecoles
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'actif'
  CHECK (statut IN ('en_attente', 'actif', 'suspendu'));

-- 2. Activate all existing schools (already active before this feature)
UPDATE public.ecoles SET statut = 'actif' WHERE statut IS NULL OR statut = 'actif';

-- 3. Grant RLS: superadmin can update statut (via existing policies or explicit)
-- Note: existing RLS policies on ecoles should already cover this if role = 'superadmin'
