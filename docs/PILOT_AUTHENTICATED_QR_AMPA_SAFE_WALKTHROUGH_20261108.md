# Wetudy · Ensayo autenticado controlado: QR, perfiles y acceso administrativo

**Preparado el 08/11/2026.** No ejecutado todavía con una sesión real de familia.
Esta guía no debe utilizar cuentas de menores ni identidades de familias reales.

## Resultado ya acreditado

- Browser smoke anónimo en Chrome escritorio y móvil **success** (PR #264, GitHub run #42502016697).
- Nuevo control en Chromium de redirección de invitados en `/admin/school`, `/admin/super` y detalle de reporte, sin credenciales ni lectura de páginas privadas.
- PostgreSQL descartable: RLS de dos centros ficticios y resolución SQL de incidencias probados (PR #260).
- QR del centro DEMO `CEIP Monteverde` funciona mediante URL directa aunque no aparece en búsqueda pública.
- No se han vinculado cuentas al centro DEMO en esta batería. No se han creado ni eliminado anuncios.

## A. Comprobación manual segura con la cuenta normal existente

**Primera fase, sin escribir datos:**

1. Entrar a `https://www.wetudy.com` e iniciar sesión en **una cuenta normal controlada**, no una cuenta AMPA ni de superadministrador. No compartir contraseñas.
2. Abrir `https://www.wetudy.com/admin/school`. Una familia normal no debe ver el panel AMPA ni códigos. Debe ser redirigida fuera del área administrativa.
3. Abrir `https://www.wetudy.com/admin/super`. No deben mostrarse herramientas ni informes de superadministrador.
4. Sin pulsar **Unirme**, abrir `https://www.wetudy.com/onboarding/join-school?school=acf4f9db-abdb-43a5-8b54-8b98d2464073`, enlace al centro QA interno. Debe visualizarse el nombre correcto y la aclaración de que seleccionar un colegio no acredita pertenencia. **No pulsar “Unirme”, “Cambiar a” ni “Desvincular”.**
5. Regresar a **Mi cuenta** y confirmar que el centro previamente seleccionado no ha cambiado.

Esta secuencia verifica accesos con sesión real SIN modificar perfil o metadata de una cuenta empleada para los seis anuncios DEMO.

## B. Prueba de persistencia, solo con cuenta aislada aprobada

La prueba realmente completa requiere una cuenta QA **sin participación en operaciones DEMO**. No reutilizar la cuenta autora o compradora de los anuncios y acuerdos DEMO. Es necesaria autorización del propietario antes de modificar su centro:
1. Iniciar sesión en esa cuenta normal.
2. Abrir enlace QR/centro QA; pulsar seleccionar centro solo en esa cuenta aprobada.
3. Comprobar que llega a marketplace, que en Mi cuenta aparece el centro seleccionado y que después de cerrar/iniciar sesión sigue igual.
4. Verificar que el rol no cambió: cero permisos AMPA/superadmin. Comprobar que no se activó ninguna comunidad del directorio.
5. Restaurar la selección anterior, si existía, y comprobar de nuevo su estado. Registrar solo resultado de prueba, nunca contraseña o token.

## C. Pendientes fuera de alcance de este ensayo

- Navegador autenticado con dos administradores AMPA autorizados para verificar aislamiento entre colegios, revocación y paneles reales.
- Moderación E2E por interfaz con una incidencia falsa **solo en entorno aislado**; no generar denuncias reales de familias.
- Los dos P0 jurídicos están **APARCADOS por decisión del fundador**, sin darlos por completados ni convertir las pruebas técnicas en aprobación legal del lanzamiento.

## Reglas de seguridad

- No enviar contraseñas, sesiones, tokens, claves API, códigos de acceso o capturas con datos personales.
- No crear usuarios nuevos, habilitar comunidades ni eliminar/modificar los seis anuncios DEMO.
- No automatizar pruebas autenticadas contra producción sin cuentas expresamente autorizadas.

## 08/11/2026 — Evidencia manual de cuenta normal (sin cambios de centro)

El fundador confirmó **«todos correctos»** después de ejecutar los tres pasos de la fase A: acceso denegado a `/admin/school` y `/admin/super` para una cuenta normal autenticada, y previsualización del centro QA Monteverde por enlace directo **sin pulsar** incorporación/cambio/desvinculación. Se registra como **APROBADA la parte de solo lectura** con cuenta normal, no como cambio de centro o persistencia demostrada.

**Evaluación no invasiva de cuentas existentes (consulta agregada sin emails/IDs):** de 11 perfiles, 5 no participan en anuncios/acuerdos DEMO ni tienen rol school_admin/super_admin; 4 de ellos no tienen centro seleccionado. **NO asumir que sean identidades QA bajo control del fundador**: ningún perfil puede utilizarse o cambiarse hasta que el propietario confirme que controla la cuenta escogida. No generar nuevas cuentas ni extraer contraseñas.

**Verificación de seguridad RLS actual:** `profiles.UPDATE` exige `auth.uid()=id` tanto en USING como WITH CHECK; `user_roles.INSERT/UPDATE` requiere ser superadministrador. El código del alta QR persiste únicamente `profiles.school_id` y `auth.updateUser(user_metadata)`, **no escribe user_roles**. La pantalla administrativa comprueba el rol real en `user_roles` y nunca concede permisos porque `profiles.school_id` sea seleccionado.

**Regresión añadida en PR #266:** `pilot-auth-school-link-guards.test.mjs` protege el retorno `next` al login/onboarding y la separación de selección de colegio frente a roles administrativos. Es una revisión de **contratos estáticos de código**, no un E2E real de persistencia y no sustituye el punto B.

**Siguiente intervención futura:** únicamente usar una cuenta QA normal, sin participación en anuncios DEMO, que el fundador identifique y controle directamente. Prueba de cambio de centro real requiere consentimiento expreso, y debe registrarse/restaurarse el valor original. No seguir con cambios de perfiles de las 5 cuentas sin comprobar su pertenencia.

