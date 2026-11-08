# Cierre seguro del ensayo E2E Wetudy (8 noviembre 2026)

**Estado (revisión 08/11/2026):** la prueba manual entre dos cuentas está completada hasta la valoración. **Decisión del fundador: conservar los seis anuncios DEMO y las evidencias asociadas hasta el lanzamiento del piloto**. No ejecutar borrado ni archivado destructivo; la moderación E2E aislada sigue pendiente.

## Verificaciones hechas

- Cuenta nueva, correo verificado, selección de SEK-Alborán del directorio nacional, sin activar ninguna comunidad.
- Anuncio claramente marcado `DEMO`, chat bidireccional, notificaciones internas y emails de Resend entregados en ambas direcciones.
- Oferta ficticia por 1 EUR: disponible → reservado → vendido; acuerdo confirmado sin pago real.
- Reseña de 5 estrellas guardada como `hidden`, excluida de reputación pública.
- No se registró atribución de conversión para la venta DEMO. **No significa** que todas las estadísticas y vistas SQL preexistentes excluyan automáticamente las demos.
- Las pruebas de navegador anónimo y contratos críticos se verificaron por separado. **No sustituyen** pruebas adversariales de autorización.

## Barreras de seguridad propuestas

1. `listings.is_demo` como columna generada, derivada de ID o prefijo DEMO del título, para excluir anuncios de prueba sin depender de listados manuales; índice parcial de anuncios reales.
2. Informes globales y escolares, superadmin, MVP y liquidez filtran anuncios DEMO y las operaciones que dependen de ellos. Las cifras de usuarios registrados y eventos de búsqueda pueden incluir cuentas o acciones de prueba y **todavía no acreditan adopción orgánica**.
3. La ruta de disputa de acuerdos rechaza DEMO antes de llamar a `server_dispute_agreement`; no se crea informe real ni se altera el acuerdo de prueba. Las denuncias de contenido potencialmente dañino por otras vías de moderación no deben bloquearse.
4. La protección de las métricas depende de desplegar **primero** la migración, **después** el frontend. No fusionar código dependiente del campo sin verificar la migración.

## Moderación y prueba de incidencias

La función de base de datos `server_dispute_agreement` hace escritura real: cambia estado del acuerdo a `disputed`, inserta `agreement_events` y un `reports.open`, y publica un mensaje automático de incidente. No ejecutar este flujo sobre la venta DEMO en producción. Los tests estáticos del código y las políticas **no** constituyen una prueba E2E de moderación.

**Pendiente:** probar el ciclo completo de denuncia y resolución en un entorno aislado con datos y cuentas de test, junto a un miembro autorizado para moderar. Si no hay una instancia de staging, mantener la prueba marcada como pendiente.

## Retención autorizada y plan de limpieza (NO ejecutar hasta el lanzamiento del piloto y nueva autorización)

1. Capturar estado SQL de solo lectura: IDs y recuentos de anuncio, fotos, conversación, mensajes, notificaciones, acuerdo, eventos, valoración, búsquedas y eventos derivados; comprobar propietario de cada fila.
2. Conservar únicamente un registro de evidencia **sin contenido de mensajes ni datos personales** en el issue privado/controlado y una copia cifrada reciente de PostgreSQL. El backup de PostgreSQL **no incluye los binarios de Storage**.
3. **Decisión tomada:** conservar los seis anuncios DEMO existentes, incluida la calculadora y sus datos de prueba (foto, chat, acuerdo y reseña oculta), hasta el lanzamiento del piloto. Esta decisión no autoriza publicarlos como operaciones reales ni borrarlos antes del lanzamiento.
4. Si se aprueba eliminar: revisar políticas de retención y cascadas, eliminar primero las referencias derivadas de prueba mediante operaciones validadas, y después el anuncio; eliminar con la API Storage **únicamente** los archivos del anuncio de test comprobados por ruta y propiedad. Verificar que no haya referencias compartidas antes de borrar un objeto.
5. **Nunca** borrar masivamente perfiles, cuentas de test, datos de otros usuarios, centros operativos, colegio nacional o directorio escolar como parte de esta limpieza.
6. Volver a medir usuarios, publicaciones reales, acuerdos reales, fotos de Storage, correos y errores después de la actuación. Registrar qué se conservó y qué se eliminó.

## Bloqueadores restantes para abrir el piloto con familias reales

- Moderación E2E en entorno de ensayo aislado.
- Auditoría completa de datos de prueba en **usuarios y búsquedas**, además de anuncios/acuerdos.
- E2E de recuperación de copia en destino aislado (no solo validar el dump cifrado).
- Revisiones de privacidad, políticas de contenido y comunicación con las tres AMPA.
- Separación de colegios informativos del directorio nacional y comunidades operativas: sigue obligatoria.

**Costes:** los cambios son una columna derivada y un índice parcial sobre listings y ajustes a consultas existentes; no requieren por sí mismos contratar otra plataforma. Vigilar índices y cardinalidad al crecer.

## Auditoría adicional — 8 noviembre 2026

- **Separación de métricas:** `listings.is_demo` está desplegado y SQL devuelve 6 DEMO, 0 anuncios reales, 1 acuerdo DEMO, 0 acuerdos reales, 0 EUR acordados reales.
- **Acceso RLS simulado en modo solo lectura y rollback:** comprador y vendedor (cuentas controladas) ven 1 conversación / 4 mensajes; comprador ve 0 notificaciones del vendedor; vendedor puede ver sus 2 notificaciones; usuario externo simulado ve 0/0/0. No acredita todos los endpoints ni permisos AMPA.
- **Adopción:** hay 11 usuarios con email confirmado y 22 búsquedas registradas (2 de cuentas conocidas de prueba, 20 de otras cuentas). Ninguna cifra acredita por sí sola usuarios orgánicos o interés comercial; clasificar cuentas y búsquedas antes de publicar conversiones.
- **Directorio:** 34.845 colegios, 0 indexables/listados/vinculados; la búsqueda de centros se usa solo para el contexto educativo de estudiantes, no activa comunidades.
- **Seguridad pendiente:** Supabase Security Advisor mantiene advertencia de leaked password protection desactivada. La resolución de incidencias con moderadores y la recuperación real del backup, incluyendo Storage, siguen pendientes.
- **Código:** PR #247–252 fusionadas; #242, #244 y #246 todavía en borrador. Seguimiento principal: issue #245.
