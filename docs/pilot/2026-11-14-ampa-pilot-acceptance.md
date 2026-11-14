# WETUDY · Plan ejecutable de aceptación de tres AMPA

**Meta:** piloto controlado antes de 26/11/2026, fecha objetivo condicionada. **No habilitar familias ni enviar correos sin consentimiento operativo.**

## Preparación (responsable humano necesario)
- Tres AMPA identificadas y autorizadas **fuera de este archivo**; no publicar nombres personales o listados de familias en GitHub.
- Dos cuentas de ensayo voluntarias y un tercero de prueba, con email y móviles controlados; no usar datos de menores, centros importados ocultos ni fotos de personas.
- Criterios legales, aviso de privacidad y consentimiento revisados antes de invitar.
- Etiquetar explícitamente anuncios y tickets de prueba y acordar limpieza reversible.

## Casos con evidencia por AMPA
| ID | Escenario | Resultado mínimo |
|---|---|---|
| AMPA-01 | Registro A y B, Turnstile, verificación de correo y login | B no accede a información privada de A |
| AMPA-02 | Centro de ensayo, solicitud nueva y permisos | Ningún centro pendiente se publica ni confiere autorización |
| AMPA-03 | Publicar anuncio sintético con foto y CP, filtrar desde B | Coincide búsqueda por radio aproximado, paginación y scroll infinito |
| AMPA-04 | B escribe a A, A responde, C intenta acceder | Sólo participantes pueden leer, escribir y recibir eventos |
| AMPA-05 | Notificación de primer mensaje, alertas y tickets | Emails llegan una vez y ningún dato privado figura en el contenido |
| AMPA-06 | Acuerdo directo y confirmación por ambos, valoración | Transiciones correctas, sin pago/envío integrado |
| AMPA-07 | Reporte y moderación | Visibilidad exclusiva autorizada y registro de resolución |
| AMPA-08 | iPhone / Android, accesibilidad y fallos 4xx/5xx | Sin regresión grave, evidencias sin datos personales |
| AMPA-09 | Archivo/limpieza test, incidencias y decisión | Evidencia rastreable y aceptación registrada por AMPA |

## Acta mínima de aceptación (una por AMPA)
- Fecha, versión SHA de despliegue, responsable autorizado, IDs de casos ejecutados.
- Resultado PASS/FAIL/SKIPPED y severidad de defectos, capturas con datos sintéticos.
- Confirmación expresa de comprensión del ámbito de piloto; decisión **APTA / NO APTA**.
- Firma o aprobación por canal privado, sin adjuntar información personal al repo.

## Puerta global
**GO sólo si**: privacidad real verificada, DR integral certificada, tres actas APTA, canal de incidentes y posibilidad de suspensión inmediata. Cualquier falla crítica en accesos, RLS, archivos, email o recuperación implica NO-GO.

Referencias: issue #245, `docs/LAUNCH_E2E_CHECKLIST_20260917.md`, PR #463-#465.
