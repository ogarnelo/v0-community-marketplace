# Wetudy — decisiones de privacidad y contraseñas (17-11-2026)

## Privacidad: titularidad pendiente
- El proyecto sigue sin responsable del tratamiento legalmente identificado, por decisión comunicada por la dirección.
- No inventar ni publicar una identidad, NIF, domicilio o entidad provisional.
- Mantener la identificación como bloqueo previo al tratamiento de datos personales reales en el piloto.
- No presentar el correo de contacto como sustituto de la identificación exigida por el artículo 13 del RGPD.
- Preparar revisión jurídica antes de activar altas reales; no resolver el bloqueo mediante cambios cosméticos en la política.

## Informes escolares: PR #610
- Envíos manuales y suscripciones limitados al email confirmado de la cuenta escolar autenticada.
- Cron vuelve a comprobar correo confirmado y rol del mismo centro para suscripciones existentes.
- La interfaz deja de permitir modificar destinatarios.
- Pendiente: ejecutar pruebas aisladas y revisar CI, comprobar compatibilidad de formularios y verificar que el envío no funciona con destinatarios históricos arbitrarios.
- No fusionar ni desplegar hasta completar esa validación.

## Contraseñas: sin Supabase Pro
- La protección administrada de contraseñas filtradas no está disponible con el plan elegido y se acepta temporalmente el riesgo.
- No contratar Pro ni alterar configuraciones de pago.
- Comprobar coherencia de políticas de contraseña en registro y restablecimiento, límites de intentos, verificación de email, MFA para administradores y recuperación de cuenta.
- Una comprobación local de longitud o complejidad no equivale a detectar contraseñas filtradas y no debe presentarse como tal.
- Cualquier mitigación debe verificarse en entornos aislados antes de despliegue.

## Fechas
- Reunión AMPA: 11 de diciembre de 2026.
- Piloto inicial: 11 de enero de 2027.
