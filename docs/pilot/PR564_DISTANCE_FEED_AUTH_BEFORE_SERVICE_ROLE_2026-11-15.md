# WETUDY — PR564 · No crear service_role antes de validar búsqueda por distancia
15/11/2026 · Corregido sobre main posterior a PR563. Sin SQL, RLS nuevo ni manipulación de usuarios.

## Regresión detectada
La ruta `GET /api/marketplace/feed` creaba `createAdminClient()` inmediatamente después de `supabase.auth.getUser()`, incluso cuando debía responder 401 a un visitante que pedía `radiusKm` o `sort=distance`, o 422 a una cuenta sin código postal. Además desestructuraba `user` sin comprobar `authError`, de modo que una respuesta Auth con datos obsoletos y error podía parecer válida.

## Cambio
Se comprueba explícitamente `authError`: ante fallo no se confía en el usuario devuelto. Las validaciones de sesión, código postal de perfil y radio se ejecutan antes de instanciar `service_role`; el feed público ordinario permanece accesible sin sesión. No cambia la distancia ni el filtro SQL.

## Pruebas
Seis tests ejecutan el handler real con Auth, perfiles, SQL y RPC simulados: radio anónimo 401 y cero service_role; Auth fallida con usuario obsoleto 401; cuenta sin CP válido 422; error de perfil 503 sin service_role; radio autenticado llega al RPC tras el control; feed general anónimo 200. Exigir CI y preview Vercel READY antes de fusión.

No se declara prueba de login real ni apertura de piloto. AMPA 0/3, DR integral pendiente y gestión de respaldos 17/11.
