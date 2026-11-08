# Consolidación de la prueba de error HTTP 503 en moderación

La prueba `scripts/pilot-moderation-integrated-pg-browser.cjs` ejecuta el componente React real, el endpoint Next real y la función SQL de moderación sobre PostgreSQL 17 desechable. Se añade una inyección **exclusivamente en el navegador CI** de una respuesta HTTP `503` con JSON de error; se comprueba que la interfaz muestre el mensaje y que la base de datos no cambie su estado, número de notificaciones ni eventos. Después se retira el interceptor y se comprueba una denegación `403` real al revocar el rol de superadministrador.

Reemplaza el escenario diferencial 503 previamente cubierto por la PR #272 sin copiar su infraestructura HTTP ficticia. La nueva prueba **no** declara que el backend real produzca 503; solo verifica que la UI lo gestiona correctamente. Ningún servicio de producción se modifica.
