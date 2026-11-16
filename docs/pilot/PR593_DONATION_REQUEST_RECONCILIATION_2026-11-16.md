# PR593 — Solicitud de donación con conflicto 409 y conciliación 503

16/11/2026. Cambia solo el servicio y la ruta POST /api/donations/request.

Antes, los errores al insertar mensaje, actualizar conversación o crear notificación podían ignorarse después de guardar solicitud. Una solicitud pending ya existente se trataba como 500 genérico.

Ahora un duplicado pending responde 409; no crea chat. La solicitud se inserta antes de crear conversación. Una vez confirmado el INSERT principal, cualquier fallo de conversación, evento, mensaje, actualización de timestamp o notificación resulta en 503 que exige conciliación, no en ok:true. Todos los errores son públicos/genéricos. Se mantiene atributo de necesidad best-effort sin registrar diagnósticos internos.

**17 tests runtime** con mocks: ocho preflight, un conflicto tipado, un positivo, cinco errores parciales y dos contratos estáticos. Ninguna prueba escribe en producción ni ejecuta correo real.

Límites: la carrera de dos solicitudes pending con el mismo anuncio/solicitante sigue sin un índice UNIQUE, y una secuencia de operaciones no es una transacción. Issue #591 sigue abierto, SQL review-only de PR592 NO aplicado. Requiere aprobación independiente para SQL; piloto general NO-GO.
