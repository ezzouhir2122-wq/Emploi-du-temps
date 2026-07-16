# Variables d'environnement

## Variables requises

| Variable | Où la trouver | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API > Project URL | Client + Serveur |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API > anon public key | Client + Serveur |

## Fichier local
`frontend/.env.local` (jamais committé en git — ajouté au .gitignore)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Vercel
Ajouter dans **Settings > Environment Variables** :
- Environnement : Production + Preview + Development
- Pas de `SUPABASE_SERVICE_ROLE_KEY` côté client (ne jamais exposer)

## Règles de sécurité
- Ne JAMAIS committer `.env.local` dans git
- Ne JAMAIS utiliser la `service_role` key côté client ou frontend
- La clé `anon` est protégée par les politiques RLS (voir rls-policies.md)
