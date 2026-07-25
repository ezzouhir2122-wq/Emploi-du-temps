# Flow d'authentification

## Mécanisme
Supabase Auth — email/password. **Deux rôles** : `admin` et `formateur`,
portés par la table `public.profiles` (liée 1-1 à `auth.users`).
Chaque profil a aussi un `statut` : `en_attente` | `valide` | `refuse`.

## Deux barrières d'accès
1. **Confirmation d'email** (SMTP — voir [smtp-email.md](smtp-email.md)).
2. **Validation manuelle par un admin** (`statut` passe à `valide`).
Un compte n'accède à l'app que si les deux sont franchies.

## Inscription (auto-service)
```
1. Utilisateur → /signup (page publique)
2. supabase.auth.signUp({ email, password, options: { data: { nom } } })
3. Trigger SQL handle_new_user() crée profiles(statut='en_attente', role=null)
4. Email de confirmation envoyé → l'utilisateur clique le lien
5. Connexion → statut != 'valide' → écran /compte-en-attente
6. Un admin valide le compte (rôle + fiche formateur) via /parametres/utilisateurs
7. statut='valide' → accès selon le rôle
```

## Connexion + aiguillage
```
1. /login → supabase.auth.signInWithPassword()
2. Session + JWT retournés
3. Middleware (frontend/src/proxy.ts) sur chaque requête :
   - charge le profil (fetchProfile) puis applique accessForUser / accessForAnon
   - non validé            → /compte-en-attente
   - admin                 → accès total
   - formateur             → /planning-fixe + /vue-mensuelle uniquement (lecture seule)
   - route non autorisée   → redirect /planning-fixe
```

## Middleware — `frontend/src/proxy.ts`
> Convention de ce repo : le middleware est `proxy.ts`, **pas** `middleware.ts`.
- Intercepte toutes les routes sauf assets statiques (voir `config.matcher`).
- `@supabase/ssr` : vérifie/rafraîchit la session côté serveur.
- Logique d'aiguillage pure et testée : `frontend/src/lib/access.ts` (tests `access.test.ts`).

## Compte admin bootstrap
Seedé par la migration `015_profiles.sql` :
`easydigia22@gmail.com` → `role='admin', statut='valide'`.
Un nouvel admin se crée en validant un compte avec le rôle Admin depuis
`/parametres/utilisateurs`.

## Rôles & sécurité
- La **RLS Postgres** est la barrière réelle (voir [rls-policies.md](rls-policies.md)) ;
  le middleware et l'UI ne font que l'ergonomie. Un formateur ne peut pas écrire
  même en contournant l'UI (policies en lecture seule).
- Un admin ne peut pas révoquer son propre compte (garde anti-lockout dans la page Utilisateurs).

## Déconnexion
`supabase.auth.signOut()` — efface la session côté client et serveur.
