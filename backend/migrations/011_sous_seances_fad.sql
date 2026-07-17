-- ============================================================
-- Migration 011 — Sous-séances FP S1/S2 + FAD Matin/PM
-- Exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Nouveaux statuts
ALTER TYPE statut_fixe ADD VALUE IF NOT EXISTS 'Matin FP S1';
ALTER TYPE statut_fixe ADD VALUE IF NOT EXISTS 'Matin FP S2';
ALTER TYPE statut_fixe ADD VALUE IF NOT EXISTS 'Après-midi FP S1';
ALTER TYPE statut_fixe ADD VALUE IF NOT EXISTS 'Après-midi FP S2';
ALTER TYPE statut_fixe ADD VALUE IF NOT EXISTS 'FAD Matin';
ALTER TYPE statut_fixe ADD VALUE IF NOT EXISTS 'FAD Après-midi';

-- 2. Changer la contrainte d'unicité : (formateur, jour) → (formateur, jour, statut)
--    pour permettre plusieurs sous-séances par jour
ALTER TABLE planning_fixe
  DROP CONSTRAINT IF EXISTS planning_fixe_formateur_id_jour_semaine_key;

ALTER TABLE planning_fixe
  ADD CONSTRAINT planning_fixe_formateur_jour_statut_key
  UNIQUE (formateur_id, jour_semaine, statut);
