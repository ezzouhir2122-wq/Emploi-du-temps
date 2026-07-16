-- ============================================================
-- Migration 005 — Salle par formateur/jour (Scénario C pool mixte)
-- ============================================================
-- Permet de stocker quelle salle un formateur occupe un jour donné
-- Utile uniquement en Scénario C (pool_mixed) — ignoré en A/B

ALTER TABLE planning_fixe
  ADD COLUMN IF NOT EXISTS salle_id UUID REFERENCES salles(id) ON DELETE SET NULL;
