# Conformité RGPD

## Données personnelles traitées
| Donnée | Table | Finalité | Base légale |
|---|---|---|---|
| Nom du formateur | `formateurs.nom` | Identification dans les plannings | Intérêt légitime (gestion RH) |
| Email admin | Supabase Auth | Authentification | Consentement (création de compte) |

## Données NON collectées
- Coordonnées personnelles (téléphone, adresse)
- Données sensibles (santé, etc.)
- Données de localisation

## Droits des personnes concernées
- **Accès** : sur demande à l'administrateur
- **Rectification** : via la page Paramètres (modification nom formateur)
- **Suppression** : désactivation du compte (`actif = false`) ou suppression complète
- **Portabilité** : export Excel disponible via la page Vue mensuelle

## Responsable du traitement
L'établissement OFPPT utilisant cette application.

## Durée de conservation
Voir `data-retention.md`.
