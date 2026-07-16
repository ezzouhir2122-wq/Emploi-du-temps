-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security — accès réservé aux utilisateurs authentifiés (admin)
-- Exécuter après 001_init_schema.sql
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE salles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE formateurs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_fixe          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotation_samedi_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_reference        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLITIQUES : accès total pour les utilisateurs authentifiés
-- (tous les utilisateurs connectés sont des admins en V1)
-- ============================================================

-- salles
CREATE POLICY "Authenticated full access on salles"
  ON salles FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- groupes
CREATE POLICY "Authenticated full access on groupes"
  ON groupes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- formateurs
CREATE POLICY "Authenticated full access on formateurs"
  ON formateurs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- planning_fixe
CREATE POLICY "Authenticated full access on planning_fixe"
  ON planning_fixe FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- rotation_samedi_config
CREATE POLICY "Authenticated full access on rotation_samedi_config"
  ON rotation_samedi_config FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- cycle_reference
CREATE POLICY "Authenticated full access on cycle_reference"
  ON cycle_reference FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- scenarios
CREATE POLICY "Authenticated full access on scenarios"
  ON scenarios FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
