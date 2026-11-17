# WETUDY — exclusividad de administradores escolares (P0, revisión)

**Resultado real del 17/11/2026:** `user_roles_school_admin_unique` es `UNIQUE(user_id, role, school_id)` para `school_admin`; admite **dos colegios distintos para el mismo usuario**. Los filtros de aplicación de PR623/624/636 impiden errores ordinarios, pero son SELECT antes de INSERT y no garantizan exclusividad ante concurrencia.

La base mantiene `user_roles_scope_check` (administrador escolar debe llevar `school_id`), la FK al colegio y la FK al usuario de Auth. El índice propuesto `UNIQUE(user_id) WHERE role='school_admin'` complementa esas garantías sin modificar `super_admin`, sin quitar RLS ni permisos ordinarios.

**No se ha ejecutado este candidato.** Requiere autorización DDL **separada**, test real en PostgreSQL 17 desechable con dos operaciones concurrentes, y valoración de que el modelo futuro de WETUDY no necesite administradores de varias AMPAs simultáneamente. Este último punto es una **decisión de producto**: el código de hoy presupone una escuela por administrador.

Antes de cualquier aplicación: ejecutar `scripts/p0_school_admin_global_uniqueness_preflight_read_only.sql`, comprobar que ambos contadores de duplicados son 0, verificar índices/constraints actuales, rollback y ventana de bloqueo, y revisar la política actual de perfiles. `CREATE UNIQUE INDEX` sin `CONCURRENTLY` puede bloquear escrituras durante su ejecución; no se ha estimado aún el coste en una base con muchos roles. No aprobar por inercia.

**Estado de los datos:** un colegio, un rol school_admin, cero usuarios con múltiples escuelas según lectura SQL del 17/11. Esos contadores NO prueban seguridad concurrente futura.
