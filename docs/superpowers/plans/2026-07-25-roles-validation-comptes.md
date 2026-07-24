# Rôles & validation des comptes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des rôles (admin / formateur) avec auto-inscription, confirmation email et validation manuelle par un admin, à l'app OFPPT Planning.

**Architecture:** Une table `profiles` liée à `auth.users` porte `role` + `statut`. La RLS Postgres est la barrière réelle (admin = accès total, formateur = lecture seule de son planning). Le middleware Next.js et une page admin « Utilisateurs » assurent l'UX. La décision d'aiguillage est extraite dans un module TypeScript pur, testé en TDD.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (Postgres + Auth SSR `@supabase/ssr`), Vitest, Tailwind + shadcn/ui.

## Global Constraints

- Node/Next : Next.js **16.2.10**, App Router. Middleware = fichier `src/proxy.ts` (convention de ce repo, PAS `middleware.ts`).
- Ne PAS modifier `frontend/src/lib/rotation.ts` (logique de cycle, fichier critique).
- Migrations SQL : fichiers numérotés dans `backend/migrations/`, exécutés **manuellement** dans l'éditeur SQL Supabase, dans l'ordre. Dernière migration existante = `014`.
- Auth : email/password Supabase. Confirmation email **activée** (deux barrières : email + validation admin).
- Compte admin bootstrap : `ezzouhir2122@gmail.com`.
- Tests : `npm run test` (Vitest, `vitest run`) depuis `frontend/`. Tests dans `frontend/src/__tests__/`.
- Gate automatisé des tâches UI (pas de harness de composants dans ce repo) : `npx tsc --noEmit` doit passer (exit 0) + vérification manuelle `npm run dev`.
- Messages de commit en français, style existant (`feat:` / `fix:` / `docs:`), avec `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**Migrations (backend/migrations/)**
- `015_profiles.sql` (créer) — table `profiles`, trigger, fonctions `is_admin()` / `current_formateur_id()`, RLS de `profiles`, backfill + seed admin.
- `016_roles_rls.sql` (créer) — DROP des policies « accès total authentifié » sur les 10 tables + nouvelles policies par rôle.

**Frontend (frontend/src/)**
- `lib/access.ts` (créer) — logique pure d'aiguillage (types + `accessDecision`).
- `__tests__/access.test.ts` (créer) — tests Vitest de `accessDecision`.
- `lib/supabase/profile.ts` (créer) — `fetchProfile(supabase, userId)`.
- `proxy.ts` (modifier) — brancher `fetchProfile` + `accessDecision`.
- `app/signup/page.tsx` (créer) — inscription publique.
- `app/compte-en-attente/page.tsx` (créer) — écran attente/refus.
- `components/RoleProvider.tsx` (créer) — contexte client `useRole()`.
- `app/(app)/layout.tsx` (modifier) — devient async, charge le profil, fournit le rôle.
- `app/(app)/parametres/utilisateurs/page.tsx` (créer) — page serveur (liste profils + formateurs).
- `app/(app)/parametres/utilisateurs/UtilisateursClient.tsx` (créer) — actions valider/refuser/rôle/liaison.
- `components/layout/Sidebar.tsx` (modifier) — lien « Utilisateurs » (admin) + masquer nav non autorisée au formateur.
- `app/(app)/planning-fixe/…` (modifier) — masquer les contrôles d'édition pour un formateur.

---

## Task 1: Migration 015 — table `profiles`, trigger, fonctions, RLS profiles, seed

**Files:**
- Create: `backend/migrations/015_profiles.sql`

**Interfaces:**
- Produces (SQL, consommé par le code et la migration 016) :
  - Table `public.profiles(id uuid, email text, nom text, role text, statut text, formateur_id uuid, created_at timestamptz)`.
  - `public.is_admin() → boolean` (SECURITY DEFINER).
  - `public.current_formateur_id() → uuid` (SECURITY DEFINER).

- [ ] **Step 1: Écrire la migration**

Créer `backend/migrations/015_profiles.sql` :

```sql
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
  WHERE email = 'ezzouhir2122@gmail.com';
```

- [ ] **Step 2: Appliquer dans Supabase**

Coller le contenu dans l'éditeur SQL Supabase et exécuter. Attendu : `Success. No rows returned` (ou le nombre de lignes backfillées).

- [ ] **Step 3: Vérifier (requêtes SQL de contrôle)**

Exécuter et vérifier les résultats :

```sql
-- Le compte admin est bien admin/valide
SELECT email, role, statut FROM profiles WHERE email = 'ezzouhir2122@gmail.com';
-- Attendu : role = admin, statut = valide

-- Les helpers existent
SELECT proname FROM pg_proc WHERE proname IN ('is_admin','current_formateur_id','handle_new_user');
-- Attendu : 3 lignes

-- Le trigger existe
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- Attendu : 1 ligne
```

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/015_profiles.sql
git commit -m "feat(db): table profiles + rôles/validation (trigger, is_admin, seed admin)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Migration 016 — RLS par rôle sur les 10 tables

**Files:**
- Create: `backend/migrations/016_roles_rls.sql`

**Interfaces:**
- Consumes : `is_admin()`, `current_formateur_id()` (Task 1).
- Produces : politiques RLS finales. Admin = accès total sur tout ; formateur = SELECT sur tables de référence + SELECT filtré sur `planning_fixe` / `rotation_samedi_config`.

**Note de conception :** un formateur a besoin de LIRE les tables de référence (`salles`, `groupes`, `formateurs`, `cycle_reference`, `poles`) pour afficher les libellés de son planning. Ses lignes de planning restent filtrées à lui seul. Les tables pédagogiques (`affectation_templates`, `affectations_modules`) restent réservées à l'admin.

- [ ] **Step 1: Écrire la migration**

Créer `backend/migrations/016_roles_rls.sql` :

```sql
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
```

- [ ] **Step 2: Appliquer dans Supabase**

Coller et exécuter dans l'éditeur SQL Supabase. Attendu : `Success`.

- [ ] **Step 3: Vérifier**

```sql
-- Toutes les tables ont bien leurs nouvelles policies
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- Attendu : plus aucune policy "Authenticated full access ...", "Auth * poles", "auth_*"
-- et présence des policies admin_*/formateur_*.
```

Vérifier aussi manuellement (après Task 7) qu'un formateur validé ne voit que ses lignes.

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/016_roles_rls.sql
git commit -m "feat(db): RLS par rôle (admin total, formateur lecture de son planning)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Logique pure d'aiguillage (`access.ts`) — TDD

**Files:**
- Create: `frontend/src/lib/access.ts`
- Test: `frontend/src/__tests__/access.test.ts`

**Interfaces:**
- Produces (consommé par `proxy.ts` Task 4, `layout.tsx` Task 8) :
  - `type ProfileStatut = 'en_attente' | 'valide' | 'refuse'`
  - `type ProfileRole = 'admin' | 'formateur' | null`
  - `interface Profile { statut: ProfileStatut; role: ProfileRole }`
  - `interface AccessDecision { allow: boolean; redirect?: string }`
  - `function accessForUser(profile: Profile | null, pathname: string): AccessDecision`
  - `function accessForAnon(pathname: string): AccessDecision`
  - Constantes exportées `FORMATEUR_ROUTES: string[]`, `ANON_ROUTES: string[]`.

- [ ] **Step 1: Écrire les tests (échouent)**

Créer `frontend/src/__tests__/access.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { accessForUser, accessForAnon, type Profile } from '@/lib/access'

const enAttente: Profile = { statut: 'en_attente', role: null }
const refuse: Profile    = { statut: 'refuse', role: null }
const admin: Profile     = { statut: 'valide', role: 'admin' }
const formateur: Profile = { statut: 'valide', role: 'formateur' }

describe('accessForAnon', () => {
  it('laisse passer /login et /signup', () => {
    expect(accessForAnon('/login').allow).toBe(true)
    expect(accessForAnon('/signup').allow).toBe(true)
  })
  it('redirige toute route protégée vers /login', () => {
    expect(accessForAnon('/planning-fixe')).toEqual({ allow: false, redirect: '/login' })
    expect(accessForAnon('/compte-en-attente')).toEqual({ allow: false, redirect: '/login' })
  })
})

describe('accessForUser — non validé', () => {
  it('force /compte-en-attente pour en_attente', () => {
    expect(accessForUser(enAttente, '/planning-fixe')).toEqual({ allow: false, redirect: '/compte-en-attente' })
  })
  it('laisse /compte-en-attente accessible', () => {
    expect(accessForUser(enAttente, '/compte-en-attente').allow).toBe(true)
  })
  it('traite refuse comme non validé', () => {
    expect(accessForUser(refuse, '/planning-fixe')).toEqual({ allow: false, redirect: '/compte-en-attente' })
  })
  it('traite un profil manquant comme non validé', () => {
    expect(accessForUser(null, '/planning-fixe')).toEqual({ allow: false, redirect: '/compte-en-attente' })
  })
})

describe('accessForUser — admin', () => {
  it('accède à tout', () => {
    expect(accessForUser(admin, '/parametres/utilisateurs').allow).toBe(true)
    expect(accessForUser(admin, '/planning-fixe').allow).toBe(true)
  })
  it('quitte les pages publiques vers /planning-fixe', () => {
    expect(accessForUser(admin, '/login')).toEqual({ allow: false, redirect: '/planning-fixe' })
    expect(accessForUser(admin, '/compte-en-attente')).toEqual({ allow: false, redirect: '/planning-fixe' })
  })
})

describe('accessForUser — formateur', () => {
  it('accède à ses routes de consultation', () => {
    expect(accessForUser(formateur, '/planning-fixe').allow).toBe(true)
    expect(accessForUser(formateur, '/vue-mensuelle').allow).toBe(true)
  })
  it('est renvoyé de toute route admin vers /planning-fixe', () => {
    expect(accessForUser(formateur, '/parametres/utilisateurs')).toEqual({ allow: false, redirect: '/planning-fixe' })
    expect(accessForUser(formateur, '/suivi-equite')).toEqual({ allow: false, redirect: '/planning-fixe' })
  })
})
```

- [ ] **Step 2: Lancer les tests → échec**

Run: `cd frontend && npm run test -- access`
Expected: FAIL (`@/lib/access` introuvable).

- [ ] **Step 3: Implémenter `access.ts`**

Créer `frontend/src/lib/access.ts` :

```ts
export type ProfileStatut = 'en_attente' | 'valide' | 'refuse'
export type ProfileRole = 'admin' | 'formateur' | null

export interface Profile {
  statut: ProfileStatut
  role: ProfileRole
}

export interface AccessDecision {
  allow: boolean
  redirect?: string
}

/** Routes accessibles sans être connecté. */
export const ANON_ROUTES = ['/login', '/signup']

/** Routes de consultation autorisées à un formateur validé. */
export const FORMATEUR_ROUTES = ['/planning-fixe', '/vue-mensuelle']

const HOME = '/planning-fixe'
const PENDING = '/compte-en-attente'

function matches(pathname: string, routes: string[]): boolean {
  return routes.some(r => pathname === r || pathname.startsWith(r + '/'))
}

/** Décision quand aucun utilisateur n'est connecté. */
export function accessForAnon(pathname: string): AccessDecision {
  if (matches(pathname, ANON_ROUTES)) return { allow: true }
  return { allow: false, redirect: '/login' }
}

/** Décision quand un utilisateur est connecté (profil éventuellement null). */
export function accessForUser(profile: Profile | null, pathname: string): AccessDecision {
  const valide = profile?.statut === 'valide'

  if (!valide) {
    if (pathname === PENDING) return { allow: true }
    return { allow: false, redirect: PENDING }
  }

  // Validé : ne pas rester sur les pages publiques / d'attente
  if (matches(pathname, ANON_ROUTES) || pathname === PENDING) {
    return { allow: false, redirect: HOME }
  }

  if (profile!.role === 'admin') return { allow: true }

  // formateur
  if (matches(pathname, FORMATEUR_ROUTES)) return { allow: true }
  return { allow: false, redirect: HOME }
}
```

- [ ] **Step 4: Lancer les tests → succès**

Run: `cd frontend && npm run test -- access`
Expected: PASS (tous les cas).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/access.ts frontend/src/__tests__/access.test.ts
git commit -m "feat: logique pure d'aiguillage par rôle/statut (accessForUser/Anon)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Helper `fetchProfile` + middleware

**Files:**
- Create: `frontend/src/lib/supabase/profile.ts`
- Modify: `frontend/src/proxy.ts`

**Interfaces:**
- Consumes : `accessForUser`, `accessForAnon`, `type Profile` (Task 3).
- Produces : `fetchProfile(supabase, userId: string): Promise<Profile | null>` (consommé par Task 8).

- [ ] **Step 1: Écrire `fetchProfile`**

Créer `frontend/src/lib/supabase/profile.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/access'

/** Charge le statut + rôle du profil d'un utilisateur. Renvoie null si absent. */
export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('statut, role')
    .eq('id', userId)
    .single()

  if (!data) return null
  return { statut: data.statut, role: data.role }
}
```

- [ ] **Step 2: Modifier le middleware `proxy.ts`**

Remplacer le corps de `frontend/src/proxy.ts` (garder la config `matcher` existante inchangée) :

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { accessForAnon, accessForUser } from '@/lib/access'
import { fetchProfile } from '@/lib/supabase/profile'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const decision = user
    ? accessForUser(await fetchProfile(supabase, user.id), pathname)
    : accessForAnon(pathname)

  if (!decision.allow && decision.redirect) {
    const url = request.nextUrl.clone()
    url.pathname = decision.redirect
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Vérification manuelle**

Run: `cd frontend && npm run dev`. Avec le compte admin bootstrap : `/login` → connexion → redirigé vers `/planning-fixe` (comportement inchangé pour l'admin). Sans être connecté : toute page → `/login`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/supabase/profile.ts frontend/src/proxy.ts
git commit -m "feat: middleware aiguille selon rôle/statut du profil

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Page d'inscription `/signup`

**Files:**
- Create: `frontend/src/app/signup/page.tsx`

**Interfaces:**
- Consumes : `createClient` de `@/lib/supabase/client` (browser).
- Produces : route publique `/signup` (déjà autorisée par `ANON_ROUTES`).

- [ ] **Step 1: Créer la page**

Créer `frontend/src/app/signup/page.tsx` (client component). Réutilise le style visuel de `login/page.tsx` (mêmes classes), avec en plus un champ `nom` passé en métadonnée, et un message de succès après inscription :

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const [nom, setNom]           = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nom } },
    })

    setLoading(false)
    if (error) {
      setError("Impossible de créer le compte. Vérifiez l'email ou réessayez.")
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] px-6">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#0A2558] mb-2">Vérifiez votre email</h2>
          <p className="text-sm text-gray-500 mb-6">
            Un lien de confirmation vous a été envoyé. Après confirmation, votre compte
            devra être validé par un administrateur avant de pouvoir accéder à l'application.
          </p>
          <Link href="/login" className="text-sm font-semibold text-[#005FAD] hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#0A2558] mb-1 tracking-tight">Créer un compte</h2>
          <p className="text-sm text-gray-500">Votre accès sera validé par un administrateur.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="nom">Nom complet</label>
            <input id="nom" type="text" value={nom} onChange={e => setNom(e.target.value)} required
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#005FAD] focus:ring-2 focus:ring-[#005FAD]/15" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="email">Adresse email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#005FAD] focus:ring-2 focus:ring-[#005FAD]/15" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password"
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#005FAD] focus:ring-2 focus:ring-[#005FAD]/15" />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full h-12 rounded-xl bg-[#005FAD] text-white font-semibold text-sm hover:bg-[#0050A0] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</> : <>Créer le compte <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Déjà un compte ? <Link href="/login" className="font-semibold text-[#005FAD] hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Ajouter le lien « Créer un compte » sur `/login`**

Dans `frontend/src/app/login/page.tsx`, sous le `<form>` (après le paragraphe footer existant), ajouter :

```tsx
<p className="mt-4 text-center text-sm text-gray-500">
  Pas encore de compte ?{' '}
  <Link href="/signup" className="font-semibold text-[#005FAD] hover:underline">Créer un compte</Link>
</p>
```

Et ajouter l'import en haut du fichier : `import Link from 'next/link'`.

- [ ] **Step 3: Type-check + vérif manuelle**

Run: `cd frontend && npx tsc --noEmit` (exit 0).
`npm run dev` → `/signup` : créer un compte de test → écran « Vérifiez votre email ».

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/signup/page.tsx frontend/src/app/login/page.tsx
git commit -m "feat: page d'inscription /signup (auto-inscription + méta nom)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Écran `/compte-en-attente`

**Files:**
- Create: `frontend/src/app/compte-en-attente/page.tsx`

**Interfaces:**
- Consumes : `createClient` de `@/lib/supabase/server` + `fetchProfile` (Task 4) pour distinguer attente/refus ; bouton de déconnexion via client.
- Produces : route `/compte-en-attente` (déjà gérée par `accessForUser`).

- [ ] **Step 1: Créer la page (serveur + bouton client de déconnexion)**

Créer `frontend/src/app/compte-en-attente/page.tsx` :

```tsx
import { createClient } from '@/lib/supabase/server'
import { fetchProfile } from '@/lib/supabase/profile'
import { LogoutButton } from './LogoutButton'
import { Clock, XCircle } from 'lucide-react'

export default async function CompteEnAttentePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await fetchProfile(supabase, user.id) : null
  const refuse = profile?.statut === 'refuse'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] px-6">
      <div className="w-full max-w-md text-center">
        {refuse
          ? <XCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
          : <Clock className="h-14 w-14 text-amber-500 mx-auto mb-4" />}
        <h1 className="text-2xl font-bold text-[#0A2558] mb-2">
          {refuse ? 'Compte refusé' : 'Compte en attente de validation'}
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {refuse
            ? "Votre demande d'accès a été refusée. Contactez l'administrateur si vous pensez qu'il s'agit d'une erreur."
            : "Votre inscription a bien été prise en compte. Un administrateur doit valider votre accès avant que vous puissiez utiliser l'application."}
        </p>
        <LogoutButton />
      </div>
    </div>
  )
}
```

Créer `frontend/src/app/compte-en-attente/LogoutButton.tsx` :

```tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()
  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  return (
    <button onClick={logout}
      className="h-11 px-6 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">
      Se déconnecter
    </button>
  )
}
```

- [ ] **Step 2: Type-check + vérif manuelle**

Run: `cd frontend && npx tsc --noEmit` (exit 0).
`npm run dev` : se connecter avec le compte de test (créé en Task 5, non encore validé, email confirmé) → redirigé vers `/compte-en-attente` → écran « en attente ». Bouton « Se déconnecter » ramène au login.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/compte-en-attente/
git commit -m "feat: écran compte en attente / refusé + déconnexion

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Page admin « Utilisateurs »

**Files:**
- Create: `frontend/src/app/(app)/parametres/utilisateurs/page.tsx`
- Create: `frontend/src/app/(app)/parametres/utilisateurs/UtilisateursClient.tsx`

**Interfaces:**
- Consumes : `createClient` serveur (chargement), `createClient` browser (mises à jour), tables `profiles` + `formateurs`.
- Produces : route admin `/parametres/utilisateurs`.

- [ ] **Step 1: Page serveur (chargement des données)**

Créer `frontend/src/app/(app)/parametres/utilisateurs/page.tsx` :

```tsx
import { createClient } from '@/lib/supabase/server'
import { UtilisateursClient, type ProfileRow, type FormateurOption } from './UtilisateursClient'

export default async function UtilisateursPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, nom, role, statut, formateur_id, created_at')
    .order('created_at', { ascending: true })

  const { data: formateurs } = await supabase
    .from('formateurs')
    .select('id, nom')
    .order('nom', { ascending: true })

  return (
    <UtilisateursClient
      initialProfiles={(profiles ?? []) as ProfileRow[]}
      formateurs={(formateurs ?? []) as FormateurOption[]}
    />
  )
}
```

- [ ] **Step 2: Composant client (actions)**

Créer `frontend/src/app/(app)/parametres/utilisateurs/UtilisateursClient.tsx`. Il liste les profils groupés par statut et permet : valider (avec rôle + formateur), refuser. Les fiches formateur déjà liées à un autre compte sont retirées du `<Select>`.

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Check, X, Clock } from 'lucide-react'

export interface ProfileRow {
  id: string
  email: string
  nom: string | null
  role: 'admin' | 'formateur' | null
  statut: 'en_attente' | 'valide' | 'refuse'
  formateur_id: string | null
  created_at: string
}
export interface FormateurOption { id: string; nom: string }

export function UtilisateursClient({
  initialProfiles, formateurs,
}: { initialProfiles: ProfileRow[]; formateurs: FormateurOption[] }) {
  const supabase = createClient()
  const [rows, setRows] = useState<ProfileRow[]>(initialProfiles)
  const [busy, setBusy] = useState<string | null>(null)
  // sélection locale par ligne : rôle + formateur
  const [choix, setChoix] = useState<Record<string, { role: 'admin' | 'formateur'; formateurId: string }>>({})

  const formateursLies = new Set(
    rows.filter(r => r.role === 'formateur' && r.formateur_id).map(r => r.formateur_id!)
  )

  function setChoixRow(id: string, patch: Partial<{ role: 'admin' | 'formateur'; formateurId: string }>) {
    setChoix(prev => ({ ...prev, [id]: { role: 'formateur', formateurId: '', ...prev[id], ...patch } }))
  }

  async function valider(row: ProfileRow) {
    const c = choix[row.id] ?? { role: 'formateur' as const, formateurId: '' }
    if (c.role === 'formateur' && !c.formateurId) {
      toast.error('Choisissez une fiche formateur.')
      return
    }
    setBusy(row.id)
    const { error } = await supabase
      .from('profiles')
      .update({
        statut: 'valide',
        role: c.role,
        formateur_id: c.role === 'formateur' ? c.formateurId : null,
      })
      .eq('id', row.id)
    setBusy(null)
    if (error) { toast.error('Échec de la validation.'); return }
    setRows(prev => prev.map(r => r.id === row.id
      ? { ...r, statut: 'valide', role: c.role, formateur_id: c.role === 'formateur' ? c.formateurId : null }
      : r))
    toast.success('Compte validé.')
  }

  async function refuser(row: ProfileRow) {
    setBusy(row.id)
    const { error } = await supabase.from('profiles')
      .update({ statut: 'refuse', role: null, formateur_id: null }).eq('id', row.id)
    setBusy(null)
    if (error) { toast.error('Échec.'); return }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, statut: 'refuse', role: null, formateur_id: null } : r))
    toast.success('Compte refusé.')
  }

  const enAttente = rows.filter(r => r.statut === 'en_attente')
  const valides   = rows.filter(r => r.statut === 'valide')
  const refuses   = rows.filter(r => r.statut === 'refuse')

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-bold text-[#0A2558]">Utilisateurs</h1>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-600 mb-3">
          <Clock className="h-4 w-4" /> En attente ({enAttente.length})
        </h2>
        <div className="space-y-2">
          {enAttente.length === 0 && <p className="text-sm text-gray-400">Aucune demande.</p>}
          {enAttente.map(row => {
            const c = choix[row.id] ?? { role: 'formateur' as const, formateurId: '' }
            return (
              <div key={row.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-40">
                  <p className="text-sm font-semibold">{row.nom ?? '—'}</p>
                  <p className="text-xs text-gray-500">{row.email}</p>
                </div>
                <select value={c.role} onChange={e => setChoixRow(row.id, { role: e.target.value as 'admin' | 'formateur' })}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                  <option value="formateur">Formateur</option>
                  <option value="admin">Admin</option>
                </select>
                {c.role === 'formateur' && (
                  <select value={c.formateurId} onChange={e => setChoixRow(row.id, { formateurId: e.target.value })}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                    <option value="">— Fiche formateur —</option>
                    {formateurs.filter(f => !formateursLies.has(f.id)).map(f => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                )}
                <button disabled={busy === row.id} onClick={() => valider(row)}
                  className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-60">
                  <Check className="h-4 w-4" /> Valider
                </button>
                <button disabled={busy === row.id} onClick={() => refuser(row)}
                  className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm font-semibold flex items-center gap-1 disabled:opacity-60">
                  <X className="h-4 w-4" /> Refuser
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-emerald-700 mb-3">Validés ({valides.length})</h2>
        <div className="space-y-1.5">
          {valides.map(row => (
            <div key={row.id} className="rounded-lg border border-gray-100 bg-white p-2.5 flex items-center gap-3 text-sm">
              <span className="flex-1 font-medium">{row.nom ?? row.email}</span>
              <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{row.role}</span>
              <button onClick={() => refuser(row)} className="text-xs text-red-500 hover:underline">Révoquer</button>
            </div>
          ))}
        </div>
      </section>

      {refuses.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Refusés ({refuses.length})</h2>
          <div className="space-y-1.5">
            {refuses.map(row => (
              <div key={row.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 flex items-center gap-3 text-sm text-gray-500">
                <span className="flex-1">{row.nom ?? row.email}</span>
                <button onClick={() => valider(row)} className="text-xs text-emerald-600 hover:underline">Re-valider</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Vérification manuelle (bout-en-bout)**

`npm run dev`, connecté en admin, aller sur `/parametres/utilisateurs` :
- le compte de test « en attente » apparaît ;
- choisir rôle = Formateur + une fiche → Valider → passe en « Validés » ;
- se déconnecter, se connecter avec le compte de test → accès à `/planning-fixe` en lecture seule, ne voit que ses lignes (vérifie la RLS de Task 2).

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(app)/parametres/utilisateurs/"
git commit -m "feat: page admin Utilisateurs (valider/refuser + rôle + liaison formateur)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Contexte de rôle, nav filtrée, planning en lecture seule

**Files:**
- Create: `frontend/src/components/RoleProvider.tsx`
- Modify: `frontend/src/app/(app)/layout.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/app/(app)/planning-fixe/` (page + composants d'édition)

**Interfaces:**
- Consumes : `fetchProfile` (Task 4), `type ProfileRole` (Task 3).
- Produces : `useRole(): { role: ProfileRole }` (hook client).

- [ ] **Step 1: Créer `RoleProvider`**

Créer `frontend/src/components/RoleProvider.tsx` :

```tsx
'use client'

import { createContext, useContext } from 'react'
import type { ProfileRole } from '@/lib/access'

const RoleContext = createContext<ProfileRole>(null)

export function RoleProvider({ role, children }: { role: ProfileRole; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useRole(): { role: ProfileRole; isAdmin: boolean; isFormateur: boolean } {
  const role = useContext(RoleContext)
  return { role, isAdmin: role === 'admin', isFormateur: role === 'formateur' }
}
```

- [ ] **Step 2: Fournir le rôle depuis le layout**

Modifier `frontend/src/app/(app)/layout.tsx` pour le rendre async, charger le profil et envelopper l'app :

```tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from 'sonner'
import { RoleProvider } from '@/components/RoleProvider'
import { createClient } from '@/lib/supabase/server'
import { fetchProfile } from '@/lib/supabase/profile'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await fetchProfile(supabase, user.id) : null

  return (
    <RoleProvider role={profile?.role ?? null}>
      <div className="flex h-full bg-[#F4F7FB]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#005FAD] via-[#00968C] to-[#005FAD] shrink-0" />
          <main className="flex-1 overflow-auto p-3">{children}</main>
        </div>
        <Toaster richColors position="bottom-right" />
      </div>
    </RoleProvider>
  )
}
```

- [ ] **Step 3: Filtrer la navigation + ajouter le lien Utilisateurs**

Dans `frontend/src/components/layout/Sidebar.tsx` :

1. Ajouter l'entrée admin dans `navItems` (après l'entrée `/parametres`), avec un champ `adminOnly` :

```ts
{ href: '/parametres/utilisateurs', label: 'Utilisateurs', icon: Users, desc: 'Comptes & rôles', group: 'config', adminOnly: true },
```
(importer `Users` depuis `lucide-react` ; ajouter `adminOnly?: boolean` au type des items.)

2. Marquer les entrées non destinées au formateur avec `adminOnly: true`. Le formateur ne garde que `planning-fixe` et `vue-mensuelle` (cf. `FORMATEUR_ROUTES`). Ajouter `adminOnly: true` à : `suivi-equite`, `scenarios`, `exports`, `affectation-modules`, `parametres`.

3. En haut du composant `Sidebar`, lire le rôle et filtrer :

```tsx
import { useRole } from '@/components/RoleProvider'
// …
const { isFormateur } = useRole()
const visibleItems = navItems.filter(i => !(isFormateur && i.adminOnly))
```

Puis remplacer les `.filter(i => i.group === '…')` par des filtres sur `visibleItems` (ex. `visibleItems.filter(i => i.group === 'planning')`). Si un groupe devient vide pour le formateur, ne pas afficher son titre.

- [ ] **Step 4: Masquer l'édition du planning pour le formateur**

Ouvrir la page `frontend/src/app/(app)/planning-fixe/` (page + composants). Pour chaque contrôle qui modifie les données (boutons d'édition, cellules cliquables déclenchant une mutation, formulaires), l'envelopper d'une garde de rôle. Exemple de motif à appliquer :

```tsx
import { useRole } from '@/components/RoleProvider'
// …
const { isFormateur } = useRole()
// …
{!isFormateur && (
  <button onClick={handleEdit}>Modifier</button>
)}
```

Pour les cellules éditables, désactiver l'interaction quand `isFormateur` (ex. ne pas attacher `onClick`, retirer les styles `cursor-pointer`). La RLS bloque déjà toute écriture d'un formateur ; cette étape supprime seulement les contrôles inopérants de l'UI.

Critère d'acceptation : connecté en formateur, la page `/planning-fixe` n'affiche aucun bouton/ः cellule d'édition ; connecté en admin, tout est inchangé.

- [ ] **Step 5: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: exit 0 (type-check) et build Next.js réussi.

- [ ] **Step 6: Vérification manuelle**

`npm run dev` :
- **Admin** : navigation complète, édition du planning disponible, `/parametres/utilisateurs` visible.
- **Formateur** (compte validé lié à une fiche) : nav réduite (Planning + Vue mensuelle), planning en lecture seule, ne voit que ses lignes. Tentative d'accès manuel à `/parametres/utilisateurs` → redirigé vers `/planning-fixe` (middleware Task 4).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/RoleProvider.tsx "frontend/src/app/(app)/layout.tsx" frontend/src/components/layout/Sidebar.tsx "frontend/src/app/(app)/planning-fixe/"
git commit -m "feat: contexte de rôle, nav filtrée formateur, planning lecture seule

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Configuration Supabase (email confirmation + URLs) — manuel

**Files:** aucun (configuration dashboard Supabase).

**Interfaces:** aucune sortie code ; prérequis pour que le flux email fonctionne en réel.

- [ ] **Step 1: Activer la confirmation d'email**

Dashboard Supabase → Authentication → Providers → Email : vérifier que **« Confirm email »** est activé.

- [ ] **Step 2: Configurer les URL de redirection**

Authentication → URL Configuration :
- **Site URL** = l'URL de production (`https://emploi-du-temps-easydigia.vercel.app`) ou l'URL locale en dev.
- Ajouter les **Redirect URLs** : l'URL de prod + `http://localhost:3000`.

- [ ] **Step 3: (Production) SMTP personnalisé**

Le service email par défaut de Supabase est limité (quelques envois/heure, usage test). Pour la production, configurer un SMTP personnalisé : Authentication → SMTP Settings. **À faire par le propriétaire du projet** — non automatisable ici. Documenter les identifiants hors du repo.

- [ ] **Step 4: Vérification bout-en-bout**

Créer un nouveau compte via `/signup` → recevoir l'email → confirmer → se connecter → écran « en attente » → valider en admin → accès formateur. Aucun commit (config externe).

---

## Self-Review

**Couverture de la spec :**
- §2 email + validation admin → Tasks 1, 5, 6, 9. Rôle choisi par admin → Task 7. ✓
- §3 parcours complet → Tasks 5→6→7→8. ✓
- §4 table/trigger/fonctions → Task 1. ✓
- §5 RLS par rôle (10 tables) → Task 2 (+ lecture référence formateur, écart signalé). ✓
- §6 signup, compte-en-attente, middleware, page admin, vue formateur → Tasks 4,5,6,7,8. ✓
- §7 bootstrap + SMTP → Task 1 (seed) + Task 9. ✓
- §8 tests → Task 3 (logique pure TDD) + vérifs SQL RLS (Tasks 1,2) + vérifs manuelles. ✓
- §9 edge cases : formateur sans fiche (Task 7 garde UI + invariant), unicité formateur (Task 1 index), refusé (Task 6), suppression fiche (`ON DELETE SET NULL` Task 1). ✓

**Placeholders :** aucun `TODO`/`TBD`. Task 8 Step 4 donne un motif concret + critère d'acceptation (le nombre exact de contrôles dépend du fichier lu par l'exécutant, mais la méthode et la garde sont explicites).

**Cohérence des types :** `Profile`/`ProfileRole`/`ProfileStatut` définis en Task 3 et réutilisés identiquement (Tasks 4, 8). `fetchProfile(supabase, userId)` défini Task 4, appelé avec la même signature Tasks 6, 8. `accessForUser`/`accessForAnon` cohérents Tasks 3–4. Fonctions SQL `is_admin()`/`current_formateur_id()` définies Task 1, utilisées Task 2.

**Écart signalé (validé oralement avec l'utilisateur) :** en Task 2, le formateur reçoit un `SELECT` sur les tables de référence (`salles`, `groupes`, `formateurs`, `cycle_reference`, `poles`) pour afficher les libellés — au-delà de la formulation stricte « seulement son planning » de la spec §5. Ses lignes de planning restent filtrées.
