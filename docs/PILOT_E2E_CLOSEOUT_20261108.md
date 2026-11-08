# Cierre seguro del ensayo E2E Wetudy (8 noviembre 2026)

**Estado:** el recorrido manual entre dos cuentas controladas está completado hasta la valoración; el cierre de artefactos y la prueba funcional de moderación siguen pendientes.

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

## Plan de limpieza (NO ejecutar sin aprobación explícita)

1. Capturar estado SQL de solo lectura: IDs y recuentos de anuncio, fotos, conversación, mensajes, notificaciones, acuerdo, eventos, valoración, búsquedas y eventos derivados; comprobar propietario de cada fila.
2. Conservar únicamente un registro de evidencia **sin contenido de mensajes ni datos personales** en el issue privado/controlado y una copia cifrada reciente de PostgreSQL. El backup de PostgreSQL **no incluye los binarios de Storage**.
3. Decidir si conservar el anuncio DEMO para demostraciones o retirarlo completamente. Por defecto **conservar sin cambios** hasta la decisión del propietario.
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
