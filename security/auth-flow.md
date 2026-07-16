# Flow d'authentification

## Mécanisme
Supabase Auth — email/password, rôle unique "administrateur".

## Flow de connexion
```
1. Utilisateur → /login (page publique)
2. Saisie email + password
3. supabase.auth.signInWithPassword()
4. Supabase retourne session + JWT
5. Middleware Next.js vérifie le JWT sur chaque requête protégée
6. Si valide → accès aux pages
7. Si invalide / expiré → redirect /login
```

## Middleware (frontend/src/middleware.ts)
- Intercepte toutes les routes sauf `/login` et `/_next/*`
- Utilise `@supabase/ssr` pour vérifier la session côté serveur
- Refresh automatique du token Supabase

## Création du compte admin
Créer manuellement dans le dashboard Supabase :
**Authentication > Users > Add User**

Ou via l'API Supabase Admin (à ne faire qu'une fois en production).

## Déconnexion
`supabase.auth.signOut()` — efface la session côté client et côté serveur.
