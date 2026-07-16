-- ============================================================
-- Migration 008 — Ajouter Samedi à l'enum jour_semaine
-- Exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Étendre l'enum (PostgreSQL 9.1+ : ADD VALUE ne nécessite pas de réécriture de table)
ALTER TYPE jour_semaine ADD VALUE IF NOT EXISTS 'Samedi';

-- 2. Ajouter la colonne salle_id à planning_fixe si absente (scénario C)
ALTER TABLE planning_fixe ADD COLUMN IF NOT EXISTS salle_id UUID REFERENCES salles(id) ON DELETE SET NULL;
