-- ============================================================
-- 015_profiles.sql
-- Rôles & validation des comptes : table profiles + helpers + RLS
-- Exécuter après 014, dans l'éditeur SQL Supabase.
-- ============================================================

-- 1) Table profiles (1 profil = 1 compte auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  nom          TEXT,
  role         TEXT CHECK (role IN ('admin','formateur')),
  statut       TEXT NOT NULL DEFAULT 'en_attente'
               CHECK (statut IN ('en_attente','valide','refuse')),
  formateur_id UUID REFERENCES formateurs(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un formateur ne peut être lié qu'à un seul compte
CREATE UNIQUE INDEX IF NOT EXISTS profiles_formateur_unique
  ON profiles (formateur_id) WHERE formateur_id IS NOT NULL;

-- 2) Création auto du profil à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, statut)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'nom', 'en_attente')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3) Helpers (SECURITY DEFINER = contournent la RLS de profiles,
--    évitent la récursion dans les policies des autres tables)
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND statut = 'valide'
  );
$$;

CREATE OR REPLACE FUNCTION current_formateur_id() RETURNS uuid
  LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT formateur_id FROM public.profiles
  WHERE id = auth.uid() AND role = 'formateur' AND statut = 'valide';
$$;

-- 4) RLS de profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
-- Pas de policy INSERT : les profils sont créés par le trigger uniquement.

-- 5) Backfill des comptes déjà existants (sinon pas de profil = bloqués)
INSERT INTO profiles (id, email, statut)
  SELECT id, email, 'en_attente' FROM auth.users
  ON CONFLICT (id) DO NOTHING;

-- 6) Bootstrap admin (sinon personne ne peut valider les autres)
UPDATE profiles SET role = 'admin', statut = 'valide'
  WHERE email = 'easydigia22@gmail.com';
