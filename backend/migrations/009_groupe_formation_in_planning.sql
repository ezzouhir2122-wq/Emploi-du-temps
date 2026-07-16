-- ============================================================
-- Migration 009 — Groupe de formation dans planning_fixe
-- Exécuter dans l'éditeur SQL Supabase
-- ============================================================

ALTER TABLE planning_fixe
  ADD COLUMN IF NOT EXISTS groupe_formation_id UUID REFERENCES groupes(id) ON DELETE SET NULL;
