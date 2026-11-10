# WETUDY — Verificación sintética de aislamiento entre familias recuperadas

11 de noviembre de 2026 · P0 #375.

Se amplía el ensayo PG17 local de búsquedas cercanas: además de restaurar filas y detectar cinco adulteraciones, comprueba las políticas RLS de las tablas sintéticas de preferencias, búsquedas y coincidencias.

Se crean dos cuentas exclusivamente ficticias y un rol PostgreSQL `qa_near_family` sin LOGIN. Las políticas, inspiradas en aislamiento por propietario mediante `request.jwt.claim.sub`, permiten que la primera familia vea únicamente sus preferencias y que la segunda vea sus propias preferencias, una búsqueda y una coincidencia. Una identidad inexistente obtiene cero filas.

Al reconstruir la base local, el ensayo vuelve a verificar la misma segregación y los permisos `SELECT`. El archivo conserva las ACL y políticas sintéticas para poner a prueba su recuperación, con nombres y datos inventados. No concede permisos a roles de producción ni contacta con Supabase.

**Límites:** No es un ensayo de las políticas RLS exactas de Wetudy, ni de GoTrue o de tokens reales. No certifica restauración integral ni autoriza las cinco migraciones pendientes; #375 sigue abierta. No se genera ninguna cuenta, anuncio, correo ni transacción real.

## Hallazgo del primer ensayo

La primera ejecución encontró que la restauración del subconjunto no había restituido el permiso `USAGE` del esquema al rol QA. El ensayo ahora lo detecta expresamente y reproduce la concesión mínima **solo dentro de la base desechable**, antes de comprobar RLS. Esta corrección del entorno sintético no se aplica a Supabase de producción. La pérdida de permisos de esquema debe considerarse en un procedimiento futuro de recuperación integral.

La siguiente ejecución también encontró que el dump parcial no había conservado los permisos `SELECT` de las tres tablas. El ejercicio los restaura explícitamente para el rol sintético antes de comprobar de nuevo las políticas RLS. Esto no significa que las ACL de la producción se reconstruyan de manera automática: deben formar parte del plan de recuperación real.
