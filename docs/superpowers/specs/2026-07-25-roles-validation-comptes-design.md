# Rôles & validation des comptes — Design

**Date** : 2026-07-25
**Statut** : Validé (design), en attente du plan d'implémentation
**Projet** : OFPPT Planning (Next.js App Router + Supabase)

## 1. Objectif

Passer d'un modèle « un seul admin, tout utilisateur connecté a un accès total » à un
modèle **multi-utilisateurs avec rôles et validation** :

- Auto-inscription publique.
- Confirmation d'email (Supabase) **puis** validation manuelle par un admin.
- Deux rôles : `admin` (accès total) et `formateur` (lecture seule de son propre planning).
- L'admin attribue le rôle au moment de la validation ; personne ne s'auto-déclare admin.

## 2. Décisions de conception (verrouillées)

| Sujet | Décision |
|---|---|
| Droits formateur | **Lecture seule** de *son* planning uniquement |
| Création des comptes | **Auto-inscription** par l'utilisateur |
| Filtre d'accès | Deux barrières : **confirmation email** (Supabase) + **validation admin** (app) |
| Attribution du rôle | **L'admin choisit** le rôle à la validation ; l'inscription ne demande aucun rôle |
| Premier admin | Compte `ezzouhir2122@gmail.com` initialisé `admin`/`valide` par SQL (bootstrap) |

## 3. Parcours utilisateur

```
Inscription (/signup)
   → Supabase envoie un email de confirmation
   → clic sur le lien  → email vérifié
   → connexion
   → middleware lit profil : statut = "en_attente"
   → écran « Compte en attente de validation » (aucune donnée visible)
   → l'admin ouvre /parametres/utilisateurs
   → APPROUVE + choisit le rôle (admin / formateur)
        └─ si formateur : relie le compte à une fiche formateur
   → prochaine visite de l'utilisateur :
        • admin      → accès total
        • formateur  → son planning en lecture seule
   → REFUSÉ → écran « Compte refusé »
```

## 4. Base de données

> **Migrations** (suite des existantes, dernière = `014`) :
> - `015_profiles.sql` : table `profiles`, trigger `on_auth_user_created`, fonctions
>   `is_admin()` / `current_formateur_id()`, seed du compte admin bootstrap.
> - `016_roles_rls.sql` : DROP des anciennes policies « Authenticated full access » +
>   nouvelles policies par rôle.

### 4.1 Nouvelle table `profiles`

| Colonne | Type | Contraintes | Rôle |
|---|---|---|---|
| `id` | uuid | PK, `REFERENCES auth.users(id) ON DELETE CASCADE` | 1 profil = 1 compte |
| `email` | text | NOT NULL | Affichage admin |
| `nom` | text | NULL | Rempli à l'inscription |
| `role` | text | `CHECK (role IN ('admin','formateur'))`, NULL par défaut | Attribué par l'admin |
| `statut` | text | `CHECK (statut IN ('en_attente','valide','refuse'))`, défaut `'en_attente'`, NOT NULL | File de validation |
| `formateur_id` | uuid | `REFERENCES formateurs(id) ON DELETE SET NULL`, unique (partiel) | Lie formateur ↔ planning |
| `created_at` | timestamptz | défaut `now()` | Ordre d'affichage |

- **Index unique partiel** sur `formateur_id WHERE formateur_id IS NOT NULL` → un formateur = un seul compte.
- **Invariant applicatif** : un profil `role='formateur'` + `statut='valide'` doit avoir un `formateur_id`.
  Vérifié côté UI admin (la validation « formateur » exige la sélection d'une fiche).

### 4.2 Trigger de création automatique du profil

```sql
-- À chaque insertion dans auth.users, créer un profil en_attente
CREATE FUNCTION handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, statut)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'nom', 'en_attente')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 4.3 Fonction `is_admin()` (anti-récursion RLS)

```sql
-- SECURITY DEFINER : contourne la RLS de profiles pour éviter la récursion
-- quand les policies des autres tables appellent is_admin().
CREATE FUNCTION is_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND statut = 'valide'
  );
$$;
```

Une fonction analogue `current_formateur_id()` (SECURITY DEFINER) renvoie le `formateur_id`
du profil courant si `statut='valide'` et `role='formateur'`, sinon NULL.

## 5. Sécurité — réécriture RLS

Migration `016_roles_rls.sql` qui **DROP** les anciennes policies « Authenticated full
access » de `002_rls_policies.sql` et les remplace.

- **Tables de config** (`salles`, `groupes`, `formateurs`, `rotation_samedi_config`,
  `cycle_reference`, `scenarios`, tables d'affectation) :
  - `FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())`.
- **`planning_fixe`** :
  - Admin : `FOR ALL USING (is_admin()) WITH CHECK (is_admin())`.
  - Formateur : `FOR SELECT USING (formateur_id = current_formateur_id())`.
- **`rotation_samedi_config`** : idem — SELECT formateur restreint à `formateur_id = current_formateur_id()`
  (en plus de l'accès admin total).
- **`profiles`** :
  - `SELECT` : `id = auth.uid()` OU `is_admin()`.
  - `UPDATE` : `is_admin()` (seul l'admin change `role`/`statut`/`formateur_id`).
  - `INSERT` : via trigger uniquement (pas de policy INSERT pour `authenticated`).
- **En attente / refusé** : `role`/`formateur_id` NULL et `is_admin()` faux → aucune ligne
  métier visible. Barrière garantie côté base, pas seulement côté UI.

## 6. Frontend (Next.js App Router)

| Élément | Chemin | Accès | Rôle |
|---|---|---|---|
| Inscription | `/signup` | Public | `signUp` + méta `nom` |
| Attente/Refus | `/compte-en-attente` | Connecté non validé | Écran informatif |
| Middleware | [proxy.ts](../../../frontend/src/proxy.ts) | — | Aiguillage selon `statut`/`role` |
| Gestion comptes | `/parametres/utilisateurs` | Admin only | Valider/Refuser + rôle + liaison |
| Vue formateur | Réutilise l'affichage planning | Formateur | Lecture seule |

### 6.1 Middleware — logique d'aiguillage

Après `supabase.auth.getUser()` :
1. Pas d'utilisateur + route protégée → `/login` (comportement actuel).
2. Utilisateur connecté → lire `profiles` (statut, role) :
   - `statut != 'valide'` → forcer `/compte-en-attente` (sauf s'il y est déjà, ou `/login`/`/signup`).
   - `statut = 'valide'` + `role='formateur'` → autoriser uniquement les routes de consultation ;
     bloquer les routes d'admin (`/parametres/*`, création/édition).
   - `statut = 'valide'` + `role='admin'` → accès complet.
3. Routes publiques : `/login`, `/signup`, `/compte-en-attente`, assets.

Le middleware n'est qu'une **commodité UX** ; la vraie protection est la RLS (section 5).

### 6.2 Page `/parametres/utilisateurs` (admin)

- Liste des profils groupés : **En attente**, **Validés**, **Refusés**.
- Par ligne en attente : bouton **Valider** (ouvre le choix du rôle) et **Refuser**.
- Choix **formateur** : `<Select>` de la fiche formateur (obligatoire si rôle = formateur,
  masque les formateurs déjà liés).
- Écritures via le client Supabase authentifié (l'admin passe la RLS `UPDATE` de `profiles`).
  Pas de clé `service_role` nécessaire (aucune création de compte côté serveur).

### 6.3 Vue formateur

Réutilise les composants d'affichage du planning existants en masquant les actions
d'édition (boutons, formulaires). Les données arrivent déjà filtrées par la RLS, donc le
formateur ne reçoit que ses lignes même si l'UI oubliait un filtre.

## 7. Bootstrap & email

- **Seed SQL** : `UPDATE profiles SET role='admin', statut='valide' WHERE email='ezzouhir2122@gmail.com';`
  (à exécuter après que ce compte existe dans `auth.users`).
- **SMTP** : le service email par défaut de Supabase est limité (quelques envois/heure, usage test).
  Pour la production, configurer un SMTP personnalisé dans Supabase (Auth → SMTP). **Action côté
  dashboard, hors code** — documentée mais non automatisée ici.

## 8. Tests

- **Logique pure** `statut/role → décision d'accès` (utilisée par le middleware) testée en isolation.
- **RLS** (tests SQL) :
  - un formateur validé ne lit que son `planning_fixe` / sa `rotation_samedi_config` ;
  - un compte `en_attente` ne lit aucune donnée métier ;
  - un formateur ne peut pas écrire.
- **Non-régression** : [rotation.ts](../../../frontend/src/lib/rotation.ts) **n'est pas modifié**.

## 9. Edge cases

| Cas | Traitement |
|---|---|
| Formateur validé sans fiche liée | Interdit : la validation « formateur » exige un `formateur_id` |
| Deux comptes sur un même formateur | Interdit par l'index unique partiel sur `formateur_id` |
| Compte refusé | Écran « Compte refusé » ; aucune donnée ; l'admin peut re-valider plus tard |
| Suppression d'une fiche formateur liée | `ON DELETE SET NULL` → le profil perd l'accès jusqu'à re-liaison |
| Admin se retire son propre rôle | À éviter côté UI (garde-fou : empêcher de se dé-valider soi-même) |

## 10. Hors périmètre (YAGNI)

- Réinitialisation de mot de passe self-service (Supabase le gère nativement si besoin, non traité ici).
- Notifications email à l'utilisateur lors de la validation/refus (peut s'ajouter plus tard).
- Gestion fine de permissions au-delà de admin/formateur.
- Édition du planning par le formateur.
