# Traçabilité et audit

## Ce qui est loggué (V1)
Supabase enregistre automatiquement les événements d'authentification dans son dashboard.

Les modifications de données (planning, rotation, formateurs) ne sont pas loggées en V1 — 
les `created_at` dans chaque table fournissent un minimum de traçabilité.

## Évolutions futures (V2)
Ajouter une table `audit_log` :
```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,         -- 'INSERT', 'UPDATE', 'DELETE'
  table_name  TEXT NOT NULL,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```
Via un trigger PostgreSQL sur chaque table sensible.

## Accès aux logs
- Logs d'auth : Supabase Dashboard > Authentication > Logs
- Logs de base de données : Supabase Dashboard > Database > Logs
