# SMTP / Emails transactionnels (confirmation de compte)

## Où vit la config
La config SMTP **n'est pas** dans le code ni dans `.env` : elle est saisie dans le
**dashboard Supabase** → `Authentication > Emails > SMTP Settings` (stockée chiffrée
côté Supabase). L'application ne lit aucune variable SMTP.

> ⚠️ Ne JAMAIS committer la clé API / le mot de passe SMTP dans le repo.
> Ce fichier documente la config, il ne contient aucun secret.

## Fournisseur : Resend
| Champ Supabase (SMTP Settings) | Valeur |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) — repli `587` (TLS) si bloqué |
| Username | `resend` |
| Password | **clé API Resend** `re_...` — *secret, hors repo* |
| Sender email | adresse sur un **domaine vérifié dans Resend** (ex. `no-reply@<domaine>`) |
| Sender name | `OFPPT Planning` |

La clé API se gère dans **Resend Dashboard > API Keys** (création / révocation / rotation).
Le domaine expéditeur doit être ajouté et vérifié dans **Resend Dashboard > Domains**
(enregistrements DNS SPF + DKIM) — sinon Resend refuse l'envoi aux vrais destinataires.

## Rotation d'une clé exposée
Si la clé fuit (collée dans un chat, un log, un commit…) :
1. Resend > API Keys > révoquer l'ancienne, en créer une nouvelle.
2. Coller la nouvelle dans Supabase > SMTP Settings > Save.
Aucun changement de code n'est nécessaire.

## Rôle dans le flux d'inscription
1ʳᵉ barrière = confirmation d'email (ce SMTP). 2ᵉ barrière = validation manuelle par un
admin. Voir [auth-flow.md](auth-flow.md) et [rls-policies.md](rls-policies.md).

Sans SMTP perso, Supabase utilise son service par défaut (~2-4 mails/h, tests only) :
suffisant en local, **insuffisant en production**.
