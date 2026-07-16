-- ============================================================
-- Migration 007 — Rotation Samedis par Salle (au lieu de par Groupe)
-- ============================================================

-- Ajouter salle_id à rotation_samedi_config
ALTER TABLE rotation_samedi_config
  ADD COLUMN IF NOT EXISTS salle_id UUID REFERENCES salles(id) ON DELETE CASCADE;

-- Ajouter salle_id à cycle_reference
ALTER TABLE cycle_reference
  ADD COLUMN IF NOT EXISTS salle_id UUID REFERENCES salles(id) ON DELETE CASCADE;

-- Index unique par salle (ignore les lignes sans salle_id = données legacy groupe)
CREATE UNIQUE INDEX IF NOT EXISTS rotation_samedi_salle_unique
  ON rotation_samedi_config(salle_id, semaine_cycle, formateur_id)
  WHERE salle_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cycle_reference_salle_unique
  ON cycle_reference(salle_id)
  WHERE salle_id IS NOT NULL;
