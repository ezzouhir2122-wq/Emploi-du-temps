-- ============================================================
-- 003_seed_data.sql
-- Données initiales : 2 salles, 2 groupes, 6 formateurs, ancrage cycle
-- Exécuter après 002_rls_policies.sql
-- ============================================================

-- UUIDs fixes pour les références croisées
-- Salles
INSERT INTO salles (id, nom) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Salle 01'),
  ('00000000-0000-0000-0000-000000000002', 'Salle 02')
ON CONFLICT (id) DO NOTHING;

-- Groupes
INSERT INTO groupes (id, nom, salle_id) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Groupe 1', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0001-000000000002', 'Groupe 2', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Formateurs Groupe 1 (Salle 01)
INSERT INTO formateurs (id, nom, groupe_id) VALUES
  ('00000000-0000-0000-0002-000000000001', 'EZZOUHIR', '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0002-000000000002', 'IKBAL',    '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0002-000000000003', 'BOUDRARE', '00000000-0000-0000-0001-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Formateurs Groupe 2 (Salle 02)
INSERT INTO formateurs (id, nom, groupe_id) VALUES
  ('00000000-0000-0000-0002-000000000004', 'HAMDI',    '00000000-0000-0000-0001-000000000002'),
  ('00000000-0000-0000-0002-000000000005', 'ELFAHSSI', '00000000-0000-0000-0001-000000000002'),
  ('00000000-0000-0000-0002-000000000006', 'JARMOUNI', '00000000-0000-0000-0001-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CYCLE DE RÉFÉRENCE
-- Premier Samedi de Septembre 2024 = 07/09/2024 = Semaine 1 du cycle
-- Le cycle ne se réinitialise JAMAIS (même en changement d'année)
-- ============================================================
INSERT INTO cycle_reference (groupe_id, date_ancrage, semaine_cycle_ancrage) VALUES
  ('00000000-0000-0000-0001-000000000001', '2024-09-07', 1),
  ('00000000-0000-0000-0001-000000000002', '2024-09-07', 1)
ON CONFLICT (groupe_id) DO NOTHING;

-- ============================================================
-- CONFIGURATION ROTATION SAMEDI (à adapter selon la réalité du planning)
-- Exemple logique : rotation équitable entre les 3 formateurs de chaque groupe
-- L'admin peut modifier ceci via la page "Rotation Samedi"
-- ============================================================

-- Groupe 1
INSERT INTO rotation_samedi_config (groupe_id, semaine_cycle, formateur_id, statut) VALUES
  -- Semaine 1 : EZZOUHIR Matin, IKBAL Après-midi, BOUDRARE Repos
  ('00000000-0000-0000-0001-000000000001', 1, '00000000-0000-0000-0002-000000000001', 'Matin'),
  ('00000000-0000-0000-0001-000000000001', 1, '00000000-0000-0000-0002-000000000002', 'Après-midi'),
  ('00000000-0000-0000-0001-000000000001', 1, '00000000-0000-0000-0002-000000000003', 'Repos'),
  -- Semaine 2 : IKBAL Matin, BOUDRARE Après-midi, EZZOUHIR Repos
  ('00000000-0000-0000-0001-000000000001', 2, '00000000-0000-0000-0002-000000000002', 'Matin'),
  ('00000000-0000-0000-0001-000000000001', 2, '00000000-0000-0000-0002-000000000003', 'Après-midi'),
  ('00000000-0000-0000-0001-000000000001', 2, '00000000-0000-0000-0002-000000000001', 'Repos'),
  -- Semaine 3 : BOUDRARE Matin, EZZOUHIR Après-midi, IKBAL Repos
  ('00000000-0000-0000-0001-000000000001', 3, '00000000-0000-0000-0002-000000000003', 'Matin'),
  ('00000000-0000-0000-0001-000000000001', 3, '00000000-0000-0000-0002-000000000001', 'Après-midi'),
  ('00000000-0000-0000-0001-000000000001', 3, '00000000-0000-0000-0002-000000000002', 'Repos')
ON CONFLICT (groupe_id, semaine_cycle, formateur_id) DO NOTHING;

-- Groupe 2
INSERT INTO rotation_samedi_config (groupe_id, semaine_cycle, formateur_id, statut) VALUES
  -- Semaine 1 : HAMDI Matin, ELFAHSSI Après-midi, JARMOUNI Repos
  ('00000000-0000-0000-0001-000000000002', 1, '00000000-0000-0000-0002-000000000004', 'Matin'),
  ('00000000-0000-0000-0001-000000000002', 1, '00000000-0000-0000-0002-000000000005', 'Après-midi'),
  ('00000000-0000-0000-0001-000000000002', 1, '00000000-0000-0000-0002-000000000006', 'Repos'),
  -- Semaine 2 : ELFAHSSI Matin, JARMOUNI Après-midi, HAMDI Repos
  ('00000000-0000-0000-0001-000000000002', 2, '00000000-0000-0000-0002-000000000005', 'Matin'),
  ('00000000-0000-0000-0001-000000000002', 2, '00000000-0000-0000-0002-000000000006', 'Après-midi'),
  ('00000000-0000-0000-0001-000000000002', 2, '00000000-0000-0000-0002-000000000004', 'Repos'),
  -- Semaine 3 : JARMOUNI Matin, HAMDI Après-midi, ELFAHSSI Repos
  ('00000000-0000-0000-0001-000000000002', 3, '00000000-0000-0000-0002-000000000006', 'Matin'),
  ('00000000-0000-0000-0001-000000000002', 3, '00000000-0000-0000-0002-000000000004', 'Après-midi'),
  ('00000000-0000-0000-0001-000000000002', 3, '00000000-0000-0000-0002-000000000005', 'Repos')
ON CONFLICT (groupe_id, semaine_cycle, formateur_id) DO NOTHING;

-- ============================================================
-- SCÉNARIOS (A actif par défaut, B et C disponibles)
-- ============================================================
INSERT INTO scenarios (nom, description, config, actif) VALUES
  (
    'Scénario A',
    '2 groupes fixes dans leur salle attitrée — configuration actuelle',
    '{"type": "groups_fixed"}',
    true
  ),
  (
    'Scénario B',
    'Les 2 groupes échangent de salle toutes les 2 semaines pour équilibrer l''usage',
    '{"type": "groups_rotating", "rotation_weeks": 2}',
    false
  ),
  (
    'Scénario C',
    'Pool mixte des 6 formateurs sur les 2 salles sans groupes figés',
    '{"type": "pool_mixed", "assignment_rule": "round_robin"}',
    false
  )
ON CONFLICT DO NOTHING;
