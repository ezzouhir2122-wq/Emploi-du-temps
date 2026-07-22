-- ============================================================
-- Migration 014 — Module d'affectation pédagogique
-- Tables : affectation_templates + affectations_modules
-- ============================================================

-- 1. Modèles d'affectation (1 ligne par module-filière dans le fichier Excel)
CREATE TABLE IF NOT EXISTS affectation_templates (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  filiere_id     uuid        NOT NULL REFERENCES poles(id) ON DELETE CASCADE,
  module         text        NOT NULL,
  masse_horaire  integer     NOT NULL CHECK (masse_horaire > 0),
  semestre       text        NOT NULL,
  mode           text        NOT NULL DEFAULT 'Présentiel',
  ordre          integer     NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

-- Un modèle = 1 seul module par filière + ordre
CREATE UNIQUE INDEX IF NOT EXISTS affectation_templates_filiere_module_key
  ON affectation_templates (filiere_id, module);

-- 2. Affectations générées (1 ligne par groupe × module × année)
CREATE TABLE IF NOT EXISTS affectations_modules (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  filiere_id     uuid        NOT NULL REFERENCES poles(id) ON DELETE CASCADE,
  groupe_id      uuid        NOT NULL REFERENCES groupes(id) ON DELETE CASCADE,
  annee          text        NOT NULL,          -- ex: '2024-2025'
  module         text        NOT NULL,
  masse_horaire  integer     NOT NULL CHECK (masse_horaire > 0),
  semestre       text        NOT NULL,
  mode           text        NOT NULL DEFAULT 'Présentiel',
  ordre          integer     NOT NULL DEFAULT 0,
  formateur_id   uuid        REFERENCES formateurs(id) ON DELETE SET NULL,
  etat           text        NOT NULL DEFAULT 'Non affecté'
                             CHECK (etat IN ('Non affecté', 'Affecté')),
  created_at     timestamptz DEFAULT now()
);

-- Empêche un doublon groupe + module + année
CREATE UNIQUE INDEX IF NOT EXISTS affectations_modules_unique_key
  ON affectations_modules (groupe_id, module, annee);

-- 3. RLS
ALTER TABLE affectation_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE affectations_modules   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_templates"   ON affectation_templates  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_templates"  ON affectation_templates  FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_affectat"    ON affectations_modules   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_affectat"   ON affectations_modules   FOR ALL    USING (auth.role() = 'authenticated');
