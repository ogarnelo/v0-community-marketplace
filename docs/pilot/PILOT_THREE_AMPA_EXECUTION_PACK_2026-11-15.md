# WETUDY — Ejecución AMPA 3/3: paquete operativo de aceptación

15 de noviembre de 2026 | issue #245 | evidencia real actual: **0/3 AMPA** | Release NO-GO.

## Propósito y separación de entornos
El trabajo autónomo de CI certifica únicamente contratos sintéticos. No acredita familias reales ni consentimiento de AMPA. No fabricar capturas, cuentas, correos ni aceptación. Para pruebas reales: autorización explícita del fundador, cuentas de ensayo controladas, datos ficticios y ninguna imagen o identificador de menores. Evitar enviar secretos/PII al chat, GitHub o logs. No publicar cambios productivos por esta guía.

## Paso previo: gates P0
- #447 privacidad: leer feeds y detalle sin exponer `postal_code`, coordenadas y datos de cuenta de otra familia; documentar escritura CP legítima y propuesta de revocar SELECT anon. Sin gate, no invitar familias.
- #455 DR: base/ACL/Auth/Storage recuperables con evidencia, no solo backups descifrados o RLS sintética; mantener NO-GO.
- PR #438 draft en rama QA, no main. Ningún ensayo de CI autoriza su merge a producción.

## Ficha de cada AMPA: mismo protocolo, evidencias sin PII
| Caso | AMPA piloto 1 | AMPA piloto 2 | AMPA piloto 3 | Criterio |
|---|---|---|---|---|
| Responsable AMPA autorizó prueba y alcance | PENDIENTE | PENDIENTE | PENDIENTE | Consentimiento operativo |
| Cuenta A (ficticia) + Turnstile + verificación correo | PENDIENTE | PENDIENTE | PENDIENTE | Acceso solo tras confirmación |
| Cuenta B independiente + aislamiento familiar | PENDIENTE | PENDIENTE | PENDIENTE | B nunca lee datos privados de A |
| Centro vinculado, centro solicitado oculto hasta aprobación | PENDIENTE | PENDIENTE | PENDIENTE | No crear centro al rechazar |
| Publicar anuncio sintético con foto neutra, curso, categoría, CP | PENDIENTE | PENDIENTE | PENDIENTE | Sin menores ni fotos privadas |
| B encuentra anuncio con filtros/CP/radio/scroll infinito | PENDIENTE | PENDIENTE | PENDIENTE | Distancia indicada aproximada |
| Chat y notificación, acuerdo A/B y cambio de estado | PENDIENTE | PENDIENTE | PENDIENTE | Ningún acceso entre terceros |
| Valoración e incidencia al panel de moderación | PENDIENTE | PENDIENTE | PENDIENTE | Correos sin duplicados ni datos privados |
| Alertas búsqueda guardada y correo de prueba | PENDIENTE | PENDIENTE | PENDIENTE | Idempotencia demostrada |
| Móvil y revisión de errores 4xx/5xx | PENDIENTE | PENDIENTE | PENDIENTE | Sin bloqueo runtime |
| Limpieza/archivo de artefactos de prueba autorizados | PENDIENTE | PENDIENTE | PENDIENTE | Sin residuos ni datos reales |
| Acta sin PII de conformidad/no conformidad | PENDIENTE | PENDIENTE | PENDIENTE | Verificado por responsable |

## Plan de acción condicionado, sin promesa de fecha
- Antes de convocar AMPA, aprobar #447 y #455 y criterios de minimización de datos; sin esos gates, pruebas locales y preparación documental solamente.
- Cada AMPA debe probar el mismo flujo de extremo a extremo usando dos cuentas independientes sin estudiantes reales.
- Registrar solamente estado por caso, resultado PASS/FAIL, fecha, código de caso y responsable interno autorizado en almacenamiento privado; no publicar datos de familias.
- Contabilizar AMPA completada solo si los casos críticos están PASS y hay aceptación explícita. No contar suites de Playwright o fixtures CI como pilotos reales.

## Semáforo de apertura
NO-GO si cualquiera: #447 pendiente, #455 recuperación integral sin ensayo, AMPA completadas < 3, E2E de aislamiento A/B fallida, permisos CP inconsistentes, restauración de Storage o Auth sin verificar, sin aprobación del fundador. Release condicionado al 26/11/2026; no garantizar GO si faltan evidencias.

Fuentes de aceptación: issue #245 y docs/LAUNCH_E2E_CHECKLIST_20260917.md. La automatización CI existente `pilot-three-ampa-real-next-browser.yml` se ejecuta en un stack local efímero con cuentas sintéticas: NO equivale a tres AMPA participantes.