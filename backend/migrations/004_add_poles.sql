-- ============================================================
-- Migration 004 — Pôles, matricule formateur, affectation
-- ============================================================

-- Table des pôles (entité organisationnelle de l'établissement)
CREATE TABLE IF NOT EXISTS poles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT        NOT NULL,
  code        TEXT,
  description TEXT,
  actif       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Code unique (nullable → pas de contrainte sur NULL)
CREATE UNIQUE INDEX IF NOT EXISTS poles_code_unique ON poles (code) WHERE code IS NOT NULL;

-- Matricule + pôle sur les formateurs
ALTER TABLE formateurs
  ADD COLUMN IF NOT EXISTS matricule TEXT,
  ADD COLUMN IF NOT EXISTS pole_id   UUID REFERENCES poles(id) ON DELETE SET NULL;

-- Pôle sur les salles
ALTER TABLE salles
  ADD COLUMN IF NOT EXISTS pole_id UUID REFERENCES poles(id) ON DELETE SET NULL;

-- Pôle sur les groupes (dérivé de la salle, mais stocké pour performance)
ALTER TABLE groupes
  ADD COLUMN IF NOT EXISTS pole_id UUID REFERENCES poles(id) ON DELETE SET NULL;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE poles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read poles"
  ON poles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth manage poles"
  ON poles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth update poles"
  ON poles FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth delete poles"
  ON poles FOR DELETE TO authenticated USING (true);
