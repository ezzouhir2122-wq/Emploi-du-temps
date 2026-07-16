# OFPPT Planning — Gestion des emplois du temps

Application web de gestion des emplois du temps pour formateurs OFPPT.

## Fonctionnalités
- **Planning fixe** Lundi–Vendredi par salle, éditable
- **Rotation Samedi** : cycle de 3 semaines perpétuel, calcul automatique pour n'importe quel mois
- **Vue mensuelle** : calendrier complet avec statut de chaque formateur chaque jour
- **Suivi équité** : compteurs Matin / Après-midi / Distance / Repos / Samedis travaillés
- **Scénarios** A/B/C : groupes fixes, échange de salle, pool mixte
- **Export** PDF et Excel du planning mensuel

## Prérequis
- Node.js 18+
- Compte Supabase
- Compte Vercel (pour le déploiement)

## Installation locale

```bash
# 1. Cloner le repo
git clone <repo-url>
cd ofppt-planning

# 2. Initialiser la base de données Supabase
# → Exécuter dans l'éditeur SQL Supabase, dans cet ordre :
#   backend/migrations/001_init_schema.sql
#   backend/migrations/002_rls_policies.sql
#   backend/migrations/003_seed_data.sql

# 3. Configurer le frontend
cd frontend
cp .env.local.example .env.local
# Éditer .env.local avec vos clés Supabase

# 4. Installer les dépendances et lancer
npm install
npm run dev
```

L'application est disponible sur http://localhost:3000

## Déploiement sur Vercel

1. Importer le repo dans Vercel
2. Dans **Settings > General**, définir **Root Directory** = `frontend`
3. Dans **Settings > Environment Variables**, ajouter :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Déployer

## Structure du projet

```
ofppt-planning/
├── frontend/       # Application Next.js
├── backend/        # Migrations SQL Supabase
├── security/       # Politiques de sécurité
└── compliance/     # Conformité RGPD
```

## Connexion admin

Un compte administrateur doit être créé manuellement dans Supabase :
**Authentication > Users > Invite User** (ou via le dashboard Supabase Auth).
