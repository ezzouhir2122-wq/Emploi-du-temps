-- ============================================================
-- Migration 010 — Distance Matin / Distance Après-midi
-- Exécuter dans l'éditeur SQL Supabase
-- ============================================================

ALTER TYPE statut_fixe ADD VALUE IF NOT EXISTS 'Distance Matin';
ALTER TYPE statut_fixe ADD VALUE IF NOT EXISTS 'Distance Après-midi';
