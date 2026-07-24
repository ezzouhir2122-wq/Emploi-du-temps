-- ============================================================
-- 016_roles_rls.sql
-- Remplace les policies « accès total authentifié » par des policies par rôle.
-- Exécuter après 015.
-- ============================================================

-- ---- Supprimer les anciennes policies (002 + 004 + 014) ----
DROP POLICY IF EXISTS "Authenticated full access on salles"                 ON salles;
DROP POLICY IF EXISTS "Authenticated full access on groupes"                ON groupes;
DROP POLICY IF EXISTS "Authenticated full access on formateurs"             ON formateurs;
DROP POLICY IF EXISTS "Authenticated full access on planning_fixe"          ON planning_fixe;
DROP POLICY IF EXISTS "Authenticated full access on rotation_samedi_config" ON rotation_samedi_config;
DROP POLICY IF EXISTS "Authenticated full access on cycle_reference"        ON cycle_reference;
DROP POLICY IF EXISTS "Authenticated full access on scenarios"              ON scenarios;
DROP POLICY IF EXISTS "Auth read poles"    ON poles;
DROP POLICY IF EXISTS "Auth manage poles"  ON poles;
DROP POLICY IF EXISTS "Auth update poles"  ON poles;
DROP POLICY IF EXISTS "Auth delete poles"  ON poles;
DROP POLICY IF EXISTS "auth_read_templates"  ON affectation_templates;
DROP POLICY IF EXISTS "auth_write_templates" ON affectation_templates;
DROP POLICY IF EXISTS "auth_read_affectat"   ON affectations_modules;
DROP POLICY IF EXISTS "auth_write_affectat"  ON affectations_modules;

-- ---- Tables de référence : admin = tout, formateur = lecture ----
-- salles
CREATE POLICY "admin_all_salles"      ON salles      FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "formateur_read_salles" ON salles      FOR SELECT TO authenticated USING (current_formateur_id() IS NOT NULL);
-- groupes
CREATE POLICY "admin_all_groupes"      ON groupes     FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "formateur_read_groupes" ON groupes     FOR SELECT TO authenticated USING (current_formateur_id() IS NOT NULL);
-- formateurs
CREATE POLICY "admin_all_formateurs"      ON formateurs  FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "formateur_read_formateurs" ON formateurs  FOR SELECT TO authenticated USING (current_formateur_id() IS NOT NULL);
-- cycle_reference
CREATE POLICY "admin_all_cycle"      ON cycle_reference FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "formateur_read_cycle" ON cycle_reference FOR SELECT TO authenticated USING (current_formateur_id() IS NOT NULL);
-- poles
CREATE POLICY "admin_all_poles"      ON poles       FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "formateur_read_poles" ON poles       FOR SELECT TO authenticated USING (current_formateur_id() IS NOT NULL);

-- ---- Tables réservées à l'admin ----
CREATE POLICY "admin_all_scenarios"    ON scenarios             FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin_all_aff_tpl"      ON affectation_templates FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin_all_aff_mod"      ON affectations_modules  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- Planning : admin = tout, formateur = SELECT de SES lignes ----
CREATE POLICY "admin_all_planning"      ON planning_fixe FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "formateur_read_planning" ON planning_fixe FOR SELECT TO authenticated USING (formateur_id = current_formateur_id());

CREATE POLICY "admin_all_rotation"      ON rotation_samedi_config FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "formateur_read_rotation" ON rotation_samedi_config FOR SELECT TO authenticated USING (formateur_id = current_formateur_id());
