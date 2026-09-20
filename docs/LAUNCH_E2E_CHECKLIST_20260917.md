# Wetudy · checklist E2E de lanzamiento

Estado: preparado para validación manual con dos cuentas reales.

## 1. Alta y seguridad
- Crear una cuenta nueva.
- Confirmar que Cloudflare Turnstile debe completarse.
- Confirmar que Wetudy avisa de revisar el email y Spam/Correo no deseado.
- Antes de pulsar el enlace de email, confirmar que no se puede iniciar sesión como cuenta activa.
- Pulsar el enlace de confirmación y comprobar que el acceso funciona.
- Confirmar que nombre y apellidos quedan guardados por separado.

## 2. Centro educativo
- Vincular un centro existente.
- Solicitar un centro nuevo.
- Confirmar que el centro solicitado NO aparece públicamente mientras esté pendiente.
- Confirmar que el superadmin recibe notificación dentro de Wetudy y email.
- Aprobar una solicitud y comprobar que solo entonces se crea/activa el centro.
- Rechazar una solicitud de prueba y confirmar que no crea un centro.

## 3. Flujo MVP entre dos cuentas
- Cuenta A publica un anuncio con foto, categoría, curso, precio y código postal.
- Cuenta B encuentra el anuncio mediante búsqueda/filtros.
- Cuenta B contacta con A desde el anuncio.
- Comprobar conversación y aviso del primer mensaje.
- Proponer un acuerdo.
- Confirmar el acuerdo por ambas partes.
- Confirmar que el anuncio pasa al estado final correspondiente.
- Crear valoración tras el acuerdo.
- Crear un report de prueba y comprobar que llega al panel de moderación.

## 4. Alertas
- Crear un ticket de soporte y comprobar notificación in-app + email de superadmin.
- Guardar una búsqueda y publicar un anuncio compatible para comprobar match/notificación.
- Comprobar que los correos duplicados no se envían de nuevo para el mismo evento.

## 5. Móvil
- iPhone 14 Pro: marketplace, anuncio, cuenta y superadmin.
- iPhone 14 bajo Zscaler: abrir una URL con ?viewport_debug=1, abrir/cerrar menú y hacer scroll hasta reproducir el descuadre.
- Tras reproducirlo, revisar logs [viewport-debug] y comparar innerWidth/clientWidth/scrollWidth/visualViewport.
- Probar al menos otro iPhone o iPad sin Zscaler para separar incompatibilidad de proxy/navegador de un bug general de Wetudy.

## 6. Cierre de lanzamiento
- Ejecutar `npm run mvp:ready` contra producción y confirmar que pasa.
- Revisar errores 4xx/5xx de producción.
- Revisar Security Advisor y Performance Advisor.
- Confirmar que no hay PRs antiguos peligrosos abiertos.
- Confirmar que checkout, pagos y envíos integrados siguen fuera del MVP.
- Confirmar que la home mantiene el ahorro del 50%-75% en libros de texto sin mostrar una fuente o marca.
- Verificar que el texto de acuerdo local sigue siendo: "La entrega y el pago se acuerdan directamente entre las partes."
