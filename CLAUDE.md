# OFPPT Planning — CLAUDE.md

## Vue d'ensemble
Application Next.js (App Router) de gestion des emplois du temps OFPPT.
6 formateurs, 2 groupes, 2 salles, planning fixe Lun-Ven + rotation Samedi sur cycle 3 semaines perpétuel.

## Structure du projet
```
ofppt-planning/
├── CLAUDE.md
├── README.md
├── frontend/          # Application Next.js (App Router, TypeScript)
├── backend/           # Migrations SQL Supabase
├── security/          # Politiques RLS, auth, variables d'env
└── compliance/        # RGPD, rétention, audit
```

## Stack technique
- **Frontend/Backend** : Next.js 14 App Router, TypeScript strict
- **Base de données** : Supabase (PostgreSQL)
- **UI** : Tailwind CSS + shadcn/ui
- **Auth** : Supabase Auth (rôle admin unique, email/password)
- **Déploiement** : Vercel (rootDirectory = `frontend/`)

## Lancer le projet en local

```bash
cd frontend
cp .env.local.example .env.local
# Remplir NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Variables d'environnement requises (frontend/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## Initialiser la base de données
Exécuter dans l'ordre dans l'éditeur SQL Supabase :
1. `backend/migrations/001_init_schema.sql`
2. `backend/migrations/002_rls_policies.sql`
3. `backend/migrations/003_seed_data.sql`

## Fichiers critiques
- `frontend/src/lib/rotation.ts` — Logique pure du cycle de 3 semaines (NE PAS modifier sans tests)
- `frontend/src/types/planning.ts` — Types métier partagés
- `frontend/src/lib/supabase/server.ts` — Client Supabase pour Server Components

## Règles métier importantes
1. Planning Lun-Ven : FIXE et permanent, jamais modifié automatiquement
2. Cycle Samedi : 3 semaines, NE SE RÉINITIALISE JAMAIS (même en changeant d'année)
3. Date d'ancrage : premier Samedi de Septembre de l'année de rentrée (seed: 07/09/2024)
4. Distance : compte dans les heures du formateur, NE compte PAS pour l'occupation salle
5. Occupation salle : exactement 1 Matin physique + 1 Après-midi physique par jour par salle
6. Max 5 jours/semaine par formateur (Distance compte comme jour travaillé)

## Déploiement Vercel
- Root Directory dans Vercel dashboard : `frontend`
- Ajouter les variables d'env dans Settings > Environment Variables
