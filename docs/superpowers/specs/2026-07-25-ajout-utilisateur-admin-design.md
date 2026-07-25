# Ajout d'utilisateur par l'admin — Design

**Date :** 2026-07-25
**Contexte :** App OFPPT Planning (Next.js 16 App Router, TS strict, Supabase). La page
admin `/parametres/utilisateurs` permet aujourd'hui de valider/refuser des comptes
auto-inscrits via `/signup`. On ajoute la possibilité pour l'admin de **créer
directement** un compte, sans passer par l'auto-inscription.

## Objectif
Un bouton « + Ajouter un utilisateur » sur `/parametres/utilisateurs` ouvre un
formulaire ; à la soumission, le compte est créé côté serveur (Supabase Admin API),
**directement actif** avec son rôle, et utilisable immédiatement.

## Décisions validées
1. **Deux modes d'accès au choix à la création** : mot de passe temporaire (affiché une
   fois) **ou** invitation par email.
2. **Compte actif immédiatement** : le formulaire porte le rôle (Formateur/Admin) + la
   fiche formateur ; le compte est créé `statut='valide'`, email auto-confirmé.
3. **Mécanisme serveur = Route Handler** `POST /api/admin/users` (approche A retenue).

## Contrainte de sécurité centrale
La création requiert la clé **`service_role`** (Supabase Admin API), qui ne doit **jamais**
être exposée au navigateur. Donc :
- La logique de création vit dans une **route serveur**.
- La route **revérifie côté serveur** que l'appelant est `role='admin'` ET `statut='valide'`
  (via le client serveur basé cookies + `fetchProfile`) **avant** toute action ; sinon `403`.
  On ne fait jamais confiance au client sur ce point.
- `SUPABASE_SERVICE_ROLE_KEY` est lu uniquement côté serveur. Déjà présent dans
  `.env.local` ; **à ajouter dans Vercel** (Production/Preview) pour la prod.

## Architecture & composants

### 1. `frontend/src/lib/supabase/admin.ts` (créer)
`createAdminClient(): SupabaseClient` — instancie un client Supabase avec l'URL et
`SUPABASE_SERVICE_ROLE_KEY`, `auth: { autoRefreshToken: false, persistSession: false }`.
**Serveur uniquement** (ne jamais importer depuis un composant client).

### 2. `frontend/src/lib/adminUsers.ts` (créer) — logique pure, testée
Types + validation du payload de création, sans dépendance Supabase/React :
```ts
export type AccessMode = 'password' | 'invite'
export interface NewUserInput {
  nom: string
  email: string
  role: 'admin' | 'formateur'
  formateurId: string | null
  mode: AccessMode
  password?: string        // requis si mode==='password'
}
export interface ValidationResult { ok: boolean; error?: string }
export function validateNewUser(input: NewUserInput): ValidationResult
```
Règles :
- `email` non vide et format email plausible → sinon `error`.
- `nom` non vide.
- `role==='formateur'` ⇒ `formateurId` non vide (fiche obligatoire).
- `role==='admin'` ⇒ `formateurId` forcé à `null`.
- `mode==='password'` ⇒ `password` présent, longueur ≥ 6.
- `mode==='invite'` ⇒ `password` ignoré.

### 3. `frontend/src/app/api/admin/users/route.ts` (créer) — Route Handler POST
Séquence :
1. Client serveur (cookies) → `getUser()` ; si absent → `401`.
2. `fetchProfile` → si `role!=='admin' || statut!=='valide'` → `403`.
3. Parse le body → `validateNewUser` ; si invalide → `400` `{ error }`.
4. `createAdminClient()` :
   - `mode==='password'` : `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nom } })`.
   - `mode==='invite'` : `auth.admin.inviteUserByEmail(email, { data: { nom } })`.
   - Erreur « email déjà utilisé » → `409` `{ error }`.
5. Le trigger `handle_new_user()` crée le profil (`en_attente`, role null). La route met
   ensuite à jour ce profil (par `id` du user créé) : `{ statut:'valide', role, formateur_id }`
   — via le client admin (contourne la RLS).
6. Réponse `200` `{ ok:true, userId }`. La route ne renvoie **pas** le mot de passe : c'est le
   client qui l'a saisi/généré, il l'affiche donc lui-même après succès (pas d'écho serveur du secret).

Note : la génération éventuelle du mot de passe se fait **côté client** (le formulaire a un
bouton « Générer » qui remplit le champ) ; la route reçoit toujours un `password` explicite en
mode password. La route ne génère rien et ne renvoie jamais le mot de passe.

### 4. `frontend/src/app/(app)/parametres/utilisateurs/AddUserForm.tsx` (créer) — client
Panneau **inline** (pas de modale ; cohérent avec le style minimaliste existant) qui se
déplie sous le bouton. Champs : `nom`, `email`, `role` (select), `fiche formateur` (select,
visible si Formateur, filtré pour exclure les fiches déjà liées — même logique
`formateursLies` que la validation), `mode` (radio/segment : Mot de passe / Invitation), et si
mode password un champ `password` + bouton « Générer ». Props : la liste `formateurs`, le set
des fiches déjà liées, et un callback `onCreated(row)` pour insérer la nouvelle ligne.
À la soumission : `validateNewUser` en local (feedback immédiat) puis `fetch('/api/admin/users', { method:'POST', body })`. En cas de succès mode password : affiche le mot de passe une
fois (bloc copiable) ; sinon toast « Invitation envoyée ». Ferme le panneau, appelle `onCreated`.

### 5. `frontend/src/app/(app)/parametres/utilisateurs/UtilisateursClient.tsx` (modifier)
- Ajouter le bouton « + Ajouter un utilisateur » (haut de page) qui ouvre/ferme `AddUserForm`.
- Passer `formateurs` + `formateursLies` au formulaire.
- `onCreated(row)` : `setRows(prev => [...prev, row])` pour un rendu optimiste.

### 6. Env / déploiement
`frontend/.env.local.example` contient déjà `SUPABASE_SERVICE_ROLE_KEY`. Action manuelle
hors code : ajouter cette variable dans **Vercel → Settings → Environment Variables**
(Production + Preview). Documenter dans `security/env-variables.md` que cette clé est
**serveur uniquement** et alimente l'API de création d'utilisateur.

## Flux de données
```
AddUserForm (client)
  └─ validateNewUser (local)  →  fetch POST /api/admin/users
route.ts (serveur)
  ├─ auth garde admin (cookies + fetchProfile)     → 401/403
  ├─ validateNewUser (re-validation serveur)       → 400
  ├─ createAdminClient() → createUser | invite      → 409 si email pris
  ├─ trigger crée profiles(en_attente)
  └─ update profiles {valide, role, formateur_id}   → 200 { ok, userId }
AddUserForm
  └─ succès → affiche le mdp (qu'il détient déjà) OU toast invitation ; onCreated(row)
UtilisateursClient
  └─ onCreated(row) → setRows optimiste
```

## Gestion des erreurs
| Cas | Réponse | UI |
|---|---|---|
| Appelant non connecté | 401 | toast « Session expirée » |
| Appelant non admin | 403 | toast « Action réservée à l'admin » |
| Payload invalide | 400 `{error}` | message inline sous le champ |
| Email déjà utilisé | 409 `{error}` | toast « Un compte avec cet email existe déjà » |
| Invitation sans SMTP configuré | 200 mais email non reçu (Supabase n'échoue pas toujours) | note UI : « Si l'email n'arrive pas, vérifiez la config SMTP » |
| Erreur serveur/réseau | 500 / rejet fetch | toast générique |

## Tests
- **`adminUsers.ts` → `validateNewUser`** en TDD (Vitest) : email vide/invalide, nom vide,
  formateur sans fiche, admin avec fiche forcée à null, password manquant/court en mode
  password, mode invite ignore le password, cas valides.
- **Route + formulaire** : vérification manuelle (le repo teste la logique pure, l'UI/IO en
  manuel). Scénarios manuels : création mode password → connexion immédiate du nouveau
  compte ; création mode invite → email reçu → définition du mot de passe → accès ; tentative
  d'appel `/api/admin/users` par un non-admin → 403.

## Hors périmètre (YAGNI)
- Édition d'un utilisateur existant (email/mot de passe) — la révocation/validation existe déjà.
- Suppression d'un compte auth (se fait au dashboard si besoin).
- Renvoi d'invitation / reset password en masse.
- Génération du mot de passe côté serveur (faite côté client, simple).
