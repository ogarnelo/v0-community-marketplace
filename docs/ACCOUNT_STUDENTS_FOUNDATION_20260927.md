# Account Students Foundation — rollout seguro

Fecha: 2026-09-27

## Decisión tras auditoría

La primera migración real será una **Fase A estrictamente aditiva**.

Solo crea `public.account_students`, sus índices y RLS.

NO modifica ni escribe en ninguna tabla de producción existente.

## Fase A

Nueva tabla:

- id
- owner_user_id -> profiles.id
- relationship: `self | guardian`
- alias opcional
- school_id
- grade_level
- academic_year
- is_primary
- active
- sort_order
- created_at / updated_at

Seguridad:

- RLS habilitado.
- usuarios autenticados solo leen sus propios estudiantes;
- INSERT / UPDATE / DELETE no se conceden al cliente;
- futuras escrituras se harán server-side.

## Invariantes de compatibilidad

Fase A NO altera:

- `profiles`
- `profiles.school_id`
- `profiles.grade_level`
- `profiles.postal_code`
- `saved_searches`
- `demand_requests`
- `listings`
- `conversations`
- `agreements`
- diseño de `/account`
- triggers de signup
- funciones de administración
- configuración de Vercel

No existe backfill en Fase A.

La tabla se crea vacía.

## Por qué se ha reducido el alcance

La propuesta inicial también añadía `student_id` a `saved_searches` y `demand_requests` y copiaba contextos históricos desde `profiles`.

La auditoría confirmó que esos cambios eran técnicamente compatibles, pero tocarían tablas existentes sin ser necesarios para validar primero la persistencia de estudiantes.

Se posponen a fases independientes.

## Fases posteriores — no preparadas para despliegue

### Fase B
APIs server-side para crear/editar estudiantes.

### Fase C
Migración voluntaria del contexto principal existente hacia `account_students`, sin borrar `profiles.school_id/grade_level`.

### Fase D
`student_id` opcional para necesidades, búsquedas guardadas, recomendaciones y alertas.

Cada fase tendrá PR y checkpoint propios.

## /account

El diseño de producción debe conservarse.

La gestión de estudiantes se integrará posteriormente dentro del diseño existente. No se sustituirá la página por la UI beta.

## Rollback de Fase A

Mientras ninguna feature dependa de la nueva tabla:

```sql
drop table if exists public.account_students;
```

No hay que restaurar datos de otras tablas porque Fase A no las modifica.

## Backups Git

- producción antes del trabajo de estudiantes:
  `backup/production-before-learners-20260927`
- beta UX validada antes de persistencia:
  `backup/my-course-beta-before-persistence-20260927`

## Estado

- SQL preparado en GitHub.
- NO aplicado a Supabase.
- NO mergeado a main.
- Producción permanece sin cambios.
