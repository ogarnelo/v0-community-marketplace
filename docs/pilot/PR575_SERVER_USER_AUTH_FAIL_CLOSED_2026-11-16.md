# PR575 — Identidad SSR: fail closed en páginas privadas

16/11/2026. Sin base de datos productiva, SQL, permisos, archivos reales, ni correos.

Se endurecen `lib/auth/server-user.ts` (utilizado por páginas Cuenta/Mensajes/Favoritos y navegación) y `lib/supabase/get-profile.ts`: ante `AuthSessionMissingError` o `session_not_found` devuelven invitado nulo; ante fallo real o excepción de proveedor lanzan un error genérico controlado, nunca continúan con datos de usuario residuales.

Se añaden **14 tests runtime** (3 escenarios invitado + 3 fallos de proveedor + 1 autenticado positivo por helper), dentro del suite de `test:pilot-security` existente. Los tests comprueban que no existen consultas de perfil bajo una sesión inválida. No se cambian políticas RLS.  NO-GO hasta E2E con identidades autorizadas/AMPAs, DR y 3 actas.
