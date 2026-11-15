# WETUDY — PR535 · Alcance exacto de la migración aprobada de 48 tablas
Fecha 15/11/2026. Corrige la propuesta de PR533 **sin ampliar ni reducir la lista de las 48 tablas autorizadas**.

## Fallo descubierto en preflight real
En Supabase Education Marketplace existen 79 tablas public (RLS ON). 48 tienen TRUNCATE para al menos un rol cliente. Sin embargo, otras 14 tablas conservan el privilegio MAINTAIN, aunque no tienen TRUNCATE. La propuesta original de PR533 revocaba sobre las 48, pero su postflight exigía ausencia de los cuatro grants en las 79; **se habría revertido por completo** al encontrar las 14 fuera de su alcance autorizado.

## Cambio y nueva verificación
- Mantener exactamente el REVOKE original sobre 48 tablas de PR533, con BEGIN/COMMIT, RLS y baseline checks.
- Preflight: confirmar que todas las 48 tablas aprobadas están presentes y que no hay TRUNCATE fuera de la allowlist.
- Postflight: comprobar los cuatro grants únicamente en las 48 tablas aprobadas; verificar que authenticated INSERT/UPDATE/DELETE, service role y la restricción de CP listings permanecen.
- Fixture PG17: reproducir las 14 tablas MAINTAIN-only fuera de alcance, garantizar que NO se les modifica el grant, repetir migración y forzar tres negativas (tabla no autorizada con TRUNCATE, RLS off, 80 tablas).
- Auditoría read-only de las 79 tablas después de aplicar: **no confundir 48 tablas corregidas con cierre completo del riesgo de MAINTAIN**.

Las 14 tablas requerirían una autorización nueva para retirar MAINTAIN. No se deben incluir en esta operación.

## PR534 impedimento independiente
El executor productivo SELECT current_user = postgres, rolsuper false, pg_has_role('postgres','supabase_admin','MEMBER') false, pg_has_role(...,'SET') false. PostgreSQL 17 permite ALTER DEFAULT PRIVILEGES FOR ROLE solo para el rol propio o sus miembros. Por ello, la transacción original de PR534 (postgres + supabase_admin) no puede completarse con este executor; no elevar permisos ni simular éxito. Hay que gestionar una ejecución autorizada en el contexto de supabase_admin, o una alternativa aprobada por la plataforma. No tocar defaults de futuras tablas inadvertidamente.

No habilitar piloto general. #245 sigue 0/3 AMPA; pruebas autenticadas/DR integral pendientes.
