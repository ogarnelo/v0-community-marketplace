# WETUDY — Evidencia del entorno real: privacidad y despliegues (15/11/2026)

**Sólo lecturas de metadatos** con Supabase MCP, Vercel y GitHub. No se consultaron filas de familias ni se ejecutó DDL/DML. Sin producción modificada, sin necesidad de Supabase Pro.

## 1. #447: permisos efectivos de catálogo productivo
Proyecto Supabase **Education Marketplace** (ref `jpsljmakoscqevssimtk`), PostgreSQL 17.6.1. Consultas SELECT a `pg_class`, `pg_attribute`, `pg_policies` y `has_*_privilege` el 15/11/2026.

| Tabla | RLS | Columnas legibles por anon (catálogo) | Política SELECT |
|---|---|---|---|
| `public.listings` | on | **36/36** (incluye `postal_code`, `seller_id`, `user_id`) | `listings_select_available_public`, `TO public`, `status='available'` |
| `public.profiles` | on | 23/23 (incluye `phone`, `postal_code`) | `profiles_select_own_or_superadmin`, `TO authenticated` |
| `public.saved_searches` | on | 27/27 | `saved_searches_select_authorized`, `TO authenticated` |
| `public.listing_drafts` | on | 0/6 | Sólo políticas own para authenticated |
| `public.school_directory` | on | 0/19 | Sin políticas |

**Conclusión delimitada:** en `listings`, grants anon + política pública para anuncios disponibles crean una vía de lectura SQL/Data API del CP exacto, independiente del endpoint de feed que elimina CP de respuesta. Es una exposición potencial sustentada en catálogo y predicado, no una extracción de filas ni demostración HTTP anónima contra producción. En `profiles` y `saved_searches` los grants globales amplios no equivalen a permiso efectivo anon porque la SELECT RLS sólo es `TO authenticated`; no calificar automáticamente como fuga.

**Migración preparada, no ejecutada:** `scripts/pilot-anon-listings-revoke-proposal.sql` revoca SELECT de anon en `listings`; `scripts/pilot-anon-listings-dml-revoke-review-only.sql` aborda DML aparte. Ambas siguen review-only. Requieren inventario de consumidores públicos, protección del flujo autenticado de CP, prueba desplegada autorizada, plan de reversión y aprobación expresa.

## 2. Asesores reales y priorización
Asesor security (15/11/2026): seis tablas con RLS enabled y ninguna política, nivel INFO (entre ellas `school_directory`, `marketplace_postal_centroids` y tablas internas de alertas/informes), y una advertencia `auth_leaked_password_protection` sobre contraseñas filtradas deshabilitada. No abrir tablas internas para silenciar el linter; RLS sin políticas puede ser protección deliberada. Revisar con propietario de Auth las opciones de su plan y la decisión antes de activar usuarios.

Asesor performance: 1 foreign key sin índice de cobertura en `saved_searches.directory_school_code` y 99 índices marcados como no utilizados. No crear ni borrar índices a ciegas: exigir EXPLAIN y volumen representativo, evitar gasto.

- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

## 3. Vercel: QA no es producción
Proyecto Vercel `v0-community-marketplace` encontrado mediante vinculación GitHub. Último despliegue QA consultado `dpl_2HxnQxXdK9RLBHEuB88wDRKZR8UU`, commit `604c2844e728b717650b34c5fa7cb41022c82782` (PR #520), `READY`, `target=null` (preview). Despliegue de producción más reciente de la consulta `dpl_9u8vpFETfZ8qnPQzAhLKviCAA5fP`, rama `main`, SHA `41bbd724013d656d6c87df02fd4934f26ce561e9`, `READY`. Un preview listo no demuestra despliegue productivo ni E2E autenticado.

## 4. PR #521 y #245
`schools.id` es UUID en catálogo productivo. PR #521 valida id antes de crear cliente de servicio; maneja 400 en entrada malformada y añade tests HTTP con dependencias simuladas; no cambia datos ni políticas.

Las 3 AMPA permanecen 0/3 certificadas por actas y E2E reales. Fecha objetivo 26/11 condicionada. **NO-GO** por #447/#455/#245. Recuperación parcial histórica ya acreditada; extracción de respaldos programada por fundador para 17/11 (no repetir hasta entonces).
