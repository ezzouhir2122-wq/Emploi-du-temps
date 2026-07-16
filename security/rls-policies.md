# Row Level Security — Supabase

## Principe
Toutes les tables ont RLS activé. Seuls les utilisateurs **authentifiés** (admin) ont accès.
Les requêtes anonymes sont refusées sur toutes les tables.

## Tables protégées
| Table | RLS activé | Politique |
|---|---|---|
| salles | ✅ | Authentifié = accès total |
| groupes | ✅ | Authentifié = accès total |
| formateurs | ✅ | Authentifié = accès total |
| planning_fixe | ✅ | Authentifié = accès total |
| rotation_samedi_config | ✅ | Authentifié = accès total |
| cycle_reference | ✅ | Authentifié = accès total |
| scenarios | ✅ | Authentifié = accès total |

## Politique appliquée (toutes tables)
```sql
CREATE POLICY "Admin full access" ON <table>
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
```

## Évolutions futures
- Ajouter un rôle `viewer` (lecture seule) pour les formateurs
- Restreindre les modifications de `cycle_reference` à un super-admin
- Ajouter des politiques par `groupe_id` pour accès partiel
