# WETUDY — Autorización P0 ACL: resultados productivos 15/11/2026

## Alcance autorizado
El responsable autorizó explícitamente retirar TRUNCATE, REFERENCES, TRIGGER y MAINTAIN de anon/authenticated en **48 tablas existentes**, más retirar los grants automáticos sobre tablas futuras creadas por **postgres y supabase_admin**. No autorizó otras 14 tablas ni abrir el piloto.

## Migración #533 — ejecución y postflight CONFIRMADOS
- PR535 corrigió el alcance de PR533 sin ampliar sus 48 tablas, tras encontrar 14 tablas adicionales con grants MAINTAIN-only. GitHub CI Critical contracts SUCCESS 43749840617 y PG17 local SUCCESS 43749840528; merge main b8c5c431de77f517d70c98ad0c4018dafb4cc15c.
- Supabase apply_migration respondió success=true; nombre `p0_public_48_tables_nonrls_privileges_20261115`, versión oficial **20261115190150**.
- Catálogo preflight: 79 tablas public (todas RLS ON), 392 concesiones ordinarias SELECT/INSERT/UPDATE/DELETE, 398 concesiones de TRUNCATE/REFERENCES/TRIGGER/MAINTAIN en 62 tablas.
- Postflight independiente: **392 concesiones ordinarias intactas**, 18 concesiones no-RLS MAINTAIN en 14 tablas fuera del alcance, **TRUNCATE=0**. 79 tablas, RLS ON 79.
- `listings`: anon SELECT 0/36 columnas, auth SELECT 33/36, auth UPDATE postal_code conservado, service_role SELECT conservado. No se consultaron ni modificaron filas personales.
- Las 14 tablas MAINTAIN-only son agreement_events, agreement_reviews, agreements, commerce_refunds, commerce_transfers, conversations, messages, payment_events, payment_intents, reports, seller_connect_accounts, shipment_events, shipments y transaction_issues. Requieren autorización separada para retirarlo; no forman parte del P0 aprobado.

## Migración #534 — resultado PARCIAL, sin simular éxito
- Postgres confirma current_user=postgres, rolsuper=false, pg_has_role(postgres,supabase_admin,MEMBER)=false y SET=false. PostgreSQL 17 permite ALTER DEFAULT PRIVILEGES FOR ROLE únicamente al dueño o a un rol miembro autorizado; no se ha elevado ningún privilegio.
- Para avanzar en el ámbito autorizado, se ejecutó una transacción atómica exclusivamente sobre defaults del propietario postgres con checks 16 grants postgres, 16 grants supabase_admin, 0 grants globales; migration `p0_default_acl_public_postgres_owner_20261115`, versión **20261115190257**, result success=true.
- Postflight independiente: `postgres/public` **0** default TABLE grants a anon/authenticated; `supabase_admin/public` conserva **16** defaults (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN para ambos roles). 0 grants globales en ambos. Existing ordinary table ACL=392 sin cambio.
- La transacción original de PR534 (ambos dueños a la vez) NO se ejecutó porque se sabe que fallaría por permisos. No confundir aprobación humana con privilegio SQL efectivo.
- `scripts/p0_public_default_acl_supabase_admin_privileged_only_review.sql`: SQL de continuación con preflight de miembro autorizado, recuentos 16/0/0, transacción y postflight 0. **NO ejecutarlo con postgres** y nunca otorgar pertenencia a supabase_admin solo para sortear este control. Requiere operador de la plataforma con autorización/rol efectivo.

## Smoke web después del cambio
- www.wetudy.com/marketplace HTTP 200.
- www.wetudy.com/api/marketplace/feed?offset=0 HTTP 200; 4 anuncios de demostración, postalCode exacto null, Cache-Control private,no-store.
- Ficha DEMO /marketplace/listing/d0000000-0000-4000-8000-000000000001 HTTP 200.

## Estado de apertura
- Cambios de seguridad productiva acordados ejecutados parcialmente según la autoridad real disponible. Pendientes defaults de supabase_admin y MAINTAIN de 14 tablas fuera de alcance.
- #245 0/3 AMPA; E2E autenticado real pendiente; DR integral pendiente. Evidencias de recuperación parcial previas respetadas; responsable programó gestión copias para 17/11.
- **NO-GO** para abrir piloto general. No activar pagos ni datos reales.
