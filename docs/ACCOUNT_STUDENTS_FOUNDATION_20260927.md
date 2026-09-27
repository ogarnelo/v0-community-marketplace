# Account Students Foundation — rollout seguro

Fecha: 2026-09-27

## Objetivo

Persistir el modelo validado en Preview:

- una cuenta `student` administra su propio contexto educativo;
- una cuenta `parent` puede administrar uno o varios estudiantes;
- el Marketplace sigue siendo general;
- `Mi curso`, recomendaciones y alertas pueden asociarse a un estudiante concreto.

## Invariantes de compatibilidad

Esta fase NO elimina ni cambia el significado actual de:

- `profiles.school_id`
- `profiles.grade_level`
- `profiles.postal_code`
- `listings`
- chat / conversations
- agreements
- diseño de `/account`

`profiles.school_id` y `profiles.grade_level` siguen funcionando como contexto principal de compatibilidad para el producto actual.

## Cambios preparados

1. Tabla nueva `public.account_students`
   - owner_user_id
   - relationship: `self | guardian`
   - alias opcional
   - school_id
   - grade_level
   - academic_year
   - is_primary
   - active
   - sort_order

2. Referencia opcional `student_id` en:
   - `demand_requests`
   - `saved_searches`

3. Backfill conservador
   - solo perfiles con `school_id` Y `grade_level`
   - `student` -> relationship `self`
   - `parent` -> relationship `guardian`
   - alias permanece null
   - no modifica el perfil existente

## Seguridad

- RLS habilitado.
- Cliente autenticado solo puede leer sus propios estudiantes.
- INSERT/UPDATE/DELETE quedan reservados al backend server-side.
- Esto evita que el cliente pueda alterar `owner_user_id` o saltarse reglas de tipo de cuenta.

## Integración posterior

Cuando se conecte el backend:

- Crear/editar estudiante se hará mediante API server-side.
- El estudiante primario podrá sincronizar `profiles.school_id/grade_level` para mantener compatibilidad visual y funcional con producción.
- Los estudiantes adicionales NO necesitan alterar la tarjeta superior actual de `/account`.
- La futura sección de estudiantes se integrará dentro del diseño actual, sin rediseñar la página.

## Rollback

Mientras ninguna feature de producción dependa de estas columnas, el rollback es:

```sql
alter table public.saved_searches drop column if exists student_id;
alter table public.demand_requests drop column if exists student_id;
drop table if exists public.account_students;
```

No se debe ejecutar el rollback una vez existan datos de estudiantes en producción sin exportarlos primero.

## Estado

- Migración versionada en GitHub.
- NO aplicada a Supabase.
- NO mergeada a main.
- Producción permanece sin cambios.

## Backup

Snapshot de producción antes de esta fase:

`backup/production-before-learners-20260927`
