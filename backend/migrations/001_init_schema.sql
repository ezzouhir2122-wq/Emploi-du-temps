-- ============================================================
-- 001_init_schema.sql
-- Schéma initial OFPPT Planning
-- Exécuter en premier dans l'éditeur SQL Supabase
-- ============================================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMs
-- ============================================================

DO $$ BEGIN
  CREATE TYPE jour_semaine AS ENUM (
    'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE statut_fixe AS ENUM (
    'Matin', 'Après-midi', 'Distance', 'Repos'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE statut_samedi AS ENUM (
    'Matin', 'Après-midi', 'Repos'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLES DE BASE
-- ============================================================

CREATE TABLE IF NOT EXISTS salles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groupes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  salle_id   UUID REFERENCES salles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formateurs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  groupe_id  UUID REFERENCES groupes(id) ON DELETE SET NULL,
  actif      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PLANNING FIXE (Lundi–Vendredi, permanent)
-- Règle : exactement 1 Matin + 1 Après-midi physique par (salle, jour)
-- Distance = télétravail : compte dans les heures, NE compte PAS pour l'occupation salle
-- ============================================================

CREATE TABLE IF NOT EXISTS planning_fixe (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id UUID NOT NULL REFERENCES formateurs(id) ON DELETE CASCADE,
  jour_semaine jour_semaine NOT NULL,
  statut       statut_fixe NOT NULL,
  UNIQUE (formateur_id, jour_semaine)
);

-- ============================================================
-- ROTATION SAMEDI
-- Cycle de 3 semaines PERPÉTUEL (ne se réinitialise jamais)
-- semaine_cycle : 1, 2 ou 3
-- ============================================================

CREATE TABLE IF NOT EXISTS rotation_samedi_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groupe_id     UUID NOT NULL REFERENCES groupes(id) ON DELETE CASCADE,
  semaine_cycle INTEGER NOT NULL CHECK (semaine_cycle IN (1, 2, 3)),
  formateur_id  UUID NOT NULL REFERENCES formateurs(id) ON DELETE CASCADE,
  statut        statut_samedi NOT NULL,
  UNIQUE (groupe_id, semaine_cycle, formateur_id)
);

-- ============================================================
-- DATE D'ANCRAGE DU CYCLE
-- date_ancrage : un Samedi de référence (ex. premier Samedi de Septembre)
-- semaine_cycle_ancrage : quelle semaine du cycle correspond à cette date
-- Formule : semaine_cycle(S) = ((ancrage - 1 + ΔSemaines) % 3) + 1
-- ============================================================

CREATE TABLE IF NOT EXISTS cycle_reference (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groupe_id             UUID NOT NULL UNIQUE REFERENCES groupes(id) ON DELETE CASCADE,
  date_ancrage          DATE NOT NULL,
  semaine_cycle_ancrage INTEGER NOT NULL DEFAULT 1 CHECK (semaine_cycle_ancrage IN (1, 2, 3))
);

-- ============================================================
-- SCÉNARIOS D'ORGANISATION
-- config JSONB : { "type": "groups_fixed" | "groups_rotating" | "pool_mixed", ... }
-- ============================================================

CREATE TABLE IF NOT EXISTS scenarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  description TEXT,
  config      JSONB NOT NULL DEFAULT '{}',
  actif       BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contrainte : un seul scénario actif à la fois
CREATE UNIQUE INDEX IF NOT EXISTS scenarios_un_seul_actif
  ON scenarios (actif)
  WHERE actif = true;
