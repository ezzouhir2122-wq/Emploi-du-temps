-- ============================================================
-- Migration 006 — Groupes de formation officiels
-- ============================================================
-- Ajoute une contrainte unique sur le nom pour éviter les doublons à l'import
CREATE UNIQUE INDEX IF NOT EXISTS groupes_nom_unique ON groupes (nom);

-- Groupes de formation (sans salle ni pôle — à affecter dans Paramètres)
INSERT INTO groupes (nom) VALUES
  -- Série GE (101–122)
  ('GE101'),('GE102'),('GE103'),('GE104'),('GE105'),('GE106'),
  ('GE107'),('GE108'),('GE109'),('GE110'),('GE111'),('GE112'),
  ('GE113'),('GE114'),('GE115'),('GE116'),('GE117'),('GE118'),
  ('GE119'),('GE120'),('GE121'),('GE122'),
  -- Série GEO 200
  ('GEOCF201'),('GEOGRH201'),('GEOCM201'),
  -- Série AA / AAOCP 200
  ('AA101'),('AAOCP201'),('AAOC201'),
  -- Série GEO 300
  ('GEOCF301'),('GEOGRH301'),('GEOCM301'),
  -- Série AAOCP 300
  ('AAOCP301'),('AAOC301')
ON CONFLICT (nom) DO NOTHING;
