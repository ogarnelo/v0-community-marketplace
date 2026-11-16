# WETUDY — Autenticación y respuestas privadas en 4 endpoints (PR posterior a #572)
Fecha: 2026-11-16. Solo cambios de rutas y pruebas; **sin SQL ni ejecución sobre cuentas reales**.

## Alcance
- `POST /api/schools/resolve-code`: no abrir el cliente privilegiado cuando Auth falla, incluso con `user` obsoleto; distinguir invitado 401 / error real 503.
- `POST /api/notifications/read` y `POST /api/notifications/read-all`: las escrituras requieren identidad comprobada; cache privada `no-store` y errores de base de datos sin detalles internos.
- `GET /api/messages/attachment`: distinguir fallo real de Auth 503 de invitado 401, con error controlado si el proveedor o cliente lanza una excepción. Preservar el control por participante, la RLS y la cabecera `nosniff`.

Pruebas runtime sintéticas: 24 negativos de Auth (invitado, sesión ausente, código de sesión ausente, avería de proveedor con usuario residual, excepción Auth y creación de cliente) más 6 casos positivos/fallo de base de datos. Sin correos, sin storage real, sin servicio privilegiado real.

## Puerta de piloto
Se mantiene **NO-GO**. Este cambio no sustituye el E2E autenticado de familias/AMPA, el ensayo de recuperación integral ni las tres aceptaciones AMPA. No autoriza índice único de fotos, respaldo ni apertura general.
