-- ============================================================
-- Migration 012 — FAD 1h (séance complémentaire pour atteindre 26h)
-- Disponible uniquement après les 2 séances FAD de 2h30
-- Exécuter dans l'éditeur SQL Supabase
-- ============================================================

ALTER TYPE statut_fixe ADD VALUE IF NOT EXISTS 'FAD 1h';
