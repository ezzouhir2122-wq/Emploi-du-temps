-- ============================================================
-- Migration 013 — Contrainte FAD fusion
-- Permet plusieurs lignes par (formateur, jour, statut) pour les
-- statuts FAD (fusion jusqu'à 3 groupes par créneau).
-- Les statuts FP gardent l'unicité stricte.
-- Exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Supprimer l'ancienne contrainte stricte
ALTER TABLE planning_fixe
  DROP CONSTRAINT IF EXISTS planning_fixe_formateur_jour_statut_key;

-- 2. Contrainte partielle : unicité uniquement pour les statuts non-FAD
CREATE UNIQUE INDEX IF NOT EXISTS planning_fixe_fp_unique
  ON planning_fixe (formateur_id, jour_semaine, statut)
  WHERE statut NOT IN (
    'FAD Matin S1', 'FAD Matin S2',
    'FAD Après-midi S1', 'FAD Après-midi S2',
    'FAD Matin', 'FAD Après-midi'
  );
