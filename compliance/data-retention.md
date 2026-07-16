# Politique de rétention des données

## Durées de conservation

| Données | Durée | Action à l'échéance |
|---|---|---|
| Planning fixe | Durée de vie du formateur dans le système | Suppression avec le formateur |
| Rotation Samedi config | Durée de l'année de formation | Archivage possible |
| Formateurs inactifs | 3 ans après désactivation | Suppression manuelle |
| Sessions Auth Supabase | Gérées par Supabase (JWT expiry configurable) | Auto-expiration |

## Procédure de suppression
1. Désactiver le formateur (`actif = false`) — conserve l'historique
2. Suppression définitive : via la page Paramètres > Formateurs > Supprimer

## Archivage
Pas de mécanisme d'archivage automatique en V1. L'export Excel mensuel sert de trace historique.
