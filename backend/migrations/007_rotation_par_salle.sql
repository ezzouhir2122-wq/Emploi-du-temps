-- ============================================================
-- Migration 007 — Rotation Samedis par Salle (au lieu de par Groupe)
-- ============================================================

-- 1. Rendre groupe_id nullable (les nouvelles entrées utilisent salle_id)
ALTER TABLE rotation_samedi_config
  ALTER COLUMN groupe_id DROP NOT NULL;

ALTER TABLE cycle_reference
  ALTER COLUMN groupe_id DROP NOT NULL;

-- 2. Ajouter salle_id aux deux tables
ALTER TABLE rotation_samedi_config
  ADD COLUMN IF NOT EXISTS salle_id UUID REFERENCES salles(id) ON DELETE CASCADE;

ALTER TABLE cycle_reference
  ADD COLUMN IF NOT EXISTS salle_id UUID REFERENCES salles(id) ON DELETE CASCADE;

-- 3. Index uniques par salle (ignorent les lignes sans salle_id = données legacy)
CREATE UNIQUE INDEX IF NOT EXISTS rotation_samedi_salle_unique
  ON rotation_samedi_config(salle_id, semaine_cycle, formateur_id)
  WHERE salle_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cycle_reference_salle_unique
  ON cycle_reference(salle_id)
  WHERE salle_id IS NOT NULL;
