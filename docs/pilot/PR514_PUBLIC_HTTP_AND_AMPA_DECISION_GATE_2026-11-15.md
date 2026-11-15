# WETUDY — PR #514: protección real de APIs públicas y límites de decisión AMPA

15 de noviembre de 2026 | rama QA exclusivamente | no `main`, no datos reales, no cambios en Supabase productivo.

## Hallazgo funcional y corrección
En `app/api/schools/public/route.ts` la búsqueda `q` contenía una cadena de escape mal formada, y `.or` recibía una expresión creada directamente a partir de texto de URL. Se sustituyó por una validación de longitud máxima (80) y alfabeto acotado a letras, números, espacios, puntos y guiones. Se rechazan `%`, `_`, comas, paréntesis, comillas y otros operadores de filtro con HTTP 400 y cache privado `no-store`, sin ejecutar la consulta elevada. El endpoint conserva `is_active=true`, `is_test=false` tanto por ID como en el listado, y solo serializa `id,name,city`. La búsqueda por signos ajenos al alfabeto permitido ahora da 400 (compromiso deliberado, revisar UX si hay solicitudes legítimas).

## Radio de marketplace: principio de mínimo privilegio
En `/api/marketplace/feed`, la creación del cliente con `service_role` se ha movido después de las validaciones de sesión y CP. Un visitante sin sesión que solicite búsqueda por distancia devuelve 401 sin crear cliente elevado; una sesión sin CP válido devuelve 422 antes del acceso elevado. El servidor sigue obteniendo CP desde el perfil del usuario, nunca desde parámetros `postal_code` de URL. La respuesta publica `postalCode:null` y distancia aproximada, no coordenadas precisas ni perfil íntegro. **Pendiente:** examen de UUID `sellerId` y consumidores de fotos antes del cierre #447.

## Pruebas que ejecutan el código de rutas (no solo grep)
`__tests__/launch/pilot-public-routes-runtime.test.mjs` transpila los módulos reales TypeScript y ejecuta su función GET con `Request`/`Response` y sustitutos en memoria de `NextResponse` y Supabase. Casos: ID de centro test/inactivo rechazado, centro real con columnas públicas, búsquedas maliciosas 400 antes de admin, errores privados no expuestos, feed anónimo sin CP/coordenadas, radio 401/422 con sesión/CP, radio autenticado usa CP del perfil aun si URL manda otro, error 503 sin detalles sensibles. El test valida handler y serialización, NO red HTTP ni la implementación real de Supabase, GoTrue, RPC geográfica, Storage o Vercel.

## Gate AMPA: no confundir revisión con aprobación
`scripts/pilot-three-ampa-release-evidence-gate.py` puede ser alimentado por un JSON local con todos los flags declarados correctos. Ahora `assess()` devuelve siempre `go:false` incluso si el manifiesto se considera completo; emite `ready_for_human_review:true` y `MANIFEST_DECLARED_READY_HUMAN_APPROVAL_REQUIRED`. La CLI sigue permitiendo generar una señal de revisión humana, con `NOT_CERTIFIED`. Una cadena de indicadores o archivos inventados no puede autorizar un lanzamiento. Se añadió prueba de CLI end-to-end sobre manifiesto sintético.

## Gates pendientes para 26/11
Privacidad productiva #447: HTTP E2E real autorizado, control de UUID/fotos, revisión de lectores con service_role y DDL/grants solo bajo aprobación del fundador. DR #455: replay del ZIP privado en Mac, restores DB/Auth/Storage, permisos, RTO/RPO. AMPA #245: tres firmas/aceptaciones humanas, no fixtures. **NO-GO de salida** hasta verificar todas; las pruebas CI no sustituyen aceptación.