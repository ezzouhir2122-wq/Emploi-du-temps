# Row Level Security — Supabase

## Principe
Toutes les tables ont RLS activé. L'accès dépend du **rôle** porté par `public.profiles` :
- **admin validé** (`is_admin()`) → accès total (FOR ALL) sur toutes les tables.
- **formateur validé** (`current_formateur_id()` non nul) → lecture seule, limitée.
- non authentifié / non validé → refusé partout.

Défini par les migrations `015_profiles.sql` (helpers + RLS de `profiles`) et
`016_roles_rls.sql` (RLS par rôle sur les 10 tables métier).

## Helpers SQL (SECURITY DEFINER, `search_path=public`)
| Fonction | Retour | Rôle |
|---|---|---|
| `is_admin()` | boolean | vrai si le profil courant est `admin` + `valide` |
| `current_formateur_id()` | uuid | `formateur_id` du profil si `formateur` + `valide`, sinon NULL |

`SECURITY DEFINER` = contournent la RLS de `profiles`, évitent la récursion dans les policies.

## Politiques par table
| Table | admin | formateur |
|---|---|---|
| salles, groupes, formateurs, cycle_reference, poles | ALL | **SELECT** (libellés du planning) |
| planning_fixe | ALL | **SELECT de ses lignes** (`formateur_id = current_formateur_id()`) |
| rotation_samedi_config | ALL | **SELECT de ses lignes** |
| scenarios, affectation_templates, affectations_modules | ALL | **aucun accès** (pédagogie réservée admin) |
| profiles | SELECT (own or admin) · UPDATE (admin) · pas d'INSERT (trigger only) | son propre profil en SELECT |

## Modèle de policy
```sql
-- admin : accès total
CREATE POLICY "admin_all_<table>" ON <table>
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- formateur : lecture (référence) ou lecture filtrée (planning)
CREATE POLICY "formateur_read_<table>" ON <table>
  FOR SELECT TO authenticated
  USING (current_formateur_id() IS NOT NULL);          -- tables de référence
  -- ou : USING (formateur_id = current_formateur_id()) -- planning
```

## Garanties
- Un compte auto-inscrit (`statut='en_attente'`, `role=null`) ne peut pas s'élever :
  pas de policy INSERT sur `profiles`, UPDATE réservé à `is_admin()`.
- Un formateur ne peut pas écrire le planning même en contournant l'UI (aucune policy
  write pour lui). La lecture seule de l'UI n'est qu'une commodité.

## Note d'exploitation
`016_roles_rls.sql` est **ré-exécutable** (DROP IF EXISTS des anciennes ET nouvelles
policies avant CREATE). Relancer le fichier entier est sans risque.
