# WETUDY · Auditoría de PR abiertas y prioridades ajustadas — 19/11/2026

**Decisión del propietario:** no habrá colegios ni AMPA reales hasta iniciar el piloto; pruebas anteriores con identidades ficticias; las pruebas E2E y aceptación reales se realizan durante el piloto limitado; Stripe, KYC y servicios a profesionales después del piloto. No se convierte la falta de 3 actas reales o dos colegios reales en un bloqueo previo al comienzo del propio piloto.

**Repo:** ogarnelo/v0-community-marketplace. Corte de auditoría sobre `main` SHA `99798da35f5bc1a8e9605acbc4dc44de7748017d`. El estado de PR puede cambiar después de este corte.

## PR recuperadas y aplicadas desde ramas antiguas, con CI verde en su nuevo HEAD

| PR actual | Fuente | Contenido recuperado | Límite |
|---|---|---|---|
| [#721](https://github.com/ogarnelo/v0-community-marketplace/pull/721) | #225 | Familias sin colegio van a /help, no a registro institucional | No crea colegios |
| [#723](https://github.com/ogarnelo/v0-community-marketplace/pull/723) | 16 ACL pendientes | Handoff del propietario y ensayo PG17 sintético | **NO aplicado** en Supabase: `postgres` no es `supabase_admin` |
| [#724](https://github.com/ogarnelo/v0-community-marketplace/pull/724) | #231 | Demo WETUDY Easy offline, Preview-only | IA real no integrada |
| [#725](https://github.com/ogarnelo/v0-community-marketplace/pull/725) | Nuevo requisito de piloto | 2 colegios, 3 AMPA, 2 FAMPA y CEAPA ficticias; test de alcance | No inserta datos en Supabase |
| [#726](https://github.com/ogarnelo/v0-community-marketplace/pull/726) | #241 | Limpieza controlada de fotos tras DELETE confirmado | Nunca borra carpetas draft compartidas |

Las PR #225, #235, #241, #466 y #618 fueron cerradas como duplicadas, antiguas o sustituidas, **sin borrar las ramas**. Los cambios que no se hayan extraído expresamente NO deben contarse como implementados.

## Revisión de las 14 PR restantes (todas DRAFT, sin integración a ciegas)

| Original | Área y evidencia vista | Acción | Prioridad ahora |
|---|---|---|---|
| [#438](https://github.com/ogarnelo/v0-community-marketplace/pull/438) | Integración apilada de anonimato, >100 archivos y cambios SQL/CI; permisos live ya difieren | Extraer solo invariantes de privacidad que falten en main, validarlos con PostgreSQL ficticio y API sin datos reales; NO fusionar bloque | P0 revisar por partes |
| [#434](https://github.com/ogarnelo/v0-community-marketplace/pull/434) | Alertas: feature flags, cron, idempotencia y propuestas SQL; issue #375 | Mantener worker inerte; extraer controles fail-closed y QA, sin habilitar correo | P1 técnico |
| [#246](https://github.com/ogarnelo/v0-community-marketplace/pull/246) | Chromium invitado móvil/escritorio contra producción | Mantener para validación de piloto, no usar como prueba de dos colegios | Piloto |
| [#244](https://github.com/ogarnelo/v0-community-marketplace/pull/244) | HTTP real sin escritura para SEO/copys/redirecciones | Mantener para revisión de piloto; no confundir smoke externo con gate de datos reales | Piloto |
| [#242](https://github.com/ogarnelo/v0-community-marketplace/pull/242) | Directorio masivo de centros y QR, SQL antiguo y dependencias | No importar 34.845 centros reales al proyecto de pilotaje en QA; revisar catálogo/identidad frente a `school_directory` existente | Piloto/revisión posterior |
| [#240](https://github.com/ogarnelo/v0-community-marketplace/pull/240) | Panel FANPA y multi-school de cadena vieja, tablas distintas de esquema #649 | NO fusionar la cadena; aprovechar modelo de reporting-only y dataset ficticio; revisar DDL federativo aparte | P1 técnico |
| [#239](https://github.com/ogarnelo/v0-community-marketplace/pull/239) | Familias multico­legio y controles de asociación, depende de PR #238 | Revisar/extraer por rutas, sin insertar colegios reales; preservar permisos familiares | P1 técnico |
| [#238](https://github.com/ogarnelo/v0-community-marketplace/pull/238) | Optimización y saneamiento de fotografías, requiere #236 | Aislar pipeline, costes y QA de tamaños/tipos con archivos ficticios | P1 técnico |
| [#236](https://github.com/ogarnelo/v0-community-marketplace/pull/236) | Saneamiento de fotos en servidor + SQL de Storage + cuotas | Revisar política real y migraciones antes de cualquier DDL; nunca merge automático de una PR vieja | P1 técnico |
| [#234](https://github.com/ogarnelo/v0-community-marketplace/pull/234) | Panel FANPA antiguo y migración de esquema rival a #649 | Priorizar FAMPA/CEAPA reporting-only ya modelado en main; no dar derechos operativos | P1 / revisar diseño |
| [#233](https://github.com/ogarnelo/v0-community-marketplace/pull/233) | 24 archivos de hardening histórico, fotos/informes/alertas/SQL | Comparar cambios particulares con main (PR posteriores han endurecido contratos); rescatar solo diferencias probadas | P1 / extracción |
| [#232](https://github.com/ogarnelo/v0-community-marketplace/pull/232) | WhatsApp IA: webhook Meta, fotos, borradores, SQL y vinculación, sin proveedor configurado ni Supabase aislado | Preparación sintética sin actividad Meta, mantener OFF y no aplicar SQL piloto en producción | P1 preparación / Meta real en piloto |
| [#231](https://github.com/ogarnelo/v0-community-marketplace/pull/231) | WETUDY Easy: API OpenAI + UX de publicación, demo extraída en #724 | Mantener endpoint real OFF; resolver cuota persistente, presupuesto y privacidad antes de activar | P1 técnico / IA real piloto |
| [#227](https://github.com/ogarnelo/v0-community-marketplace/pull/227) | Correo automático a superadmins por altas confirmadas | No activar correo real de nuevas familias por una PR vieja; revisar idempotencia/consentimiento en piloto | Piloto |

## Orden de ejecución desde hoy

1. **P0 sin credenciales ajenas:** cerrar diseño/resto de pruebas de privacidad/Storage/ACL con datos sintéticos, y revisar si la integración de la RPC #681/#682 se puede activar de manera controlada **sin** usar proveedores reales ni publicar el piloto general.
2. **P1 funcional:** rescatar saneamiento de fotos (#236/#238), multico­legio (#239) y reporting-only de federaciones (#234/#240/#649), en PR separadas con CI y fixtures sintéticos.
3. **IA bajo flag apagado:** preparar WhatsApp (#232) y Easy (#231) sintéticamente; requerir autorización Meta y presupuestos solo para ensayo real.
4. **Mover al piloto:** navegador con usuarios reales, colegios reales, aceptaciones de AMPA, restauración integral final, SEO/observabilidad de adopción real y correo real.
5. **Después del piloto:** Stripe live, profesionales, KYC, cobros y monetización.

## Estado de la ACL que sí requiere tercero

En Supabase Education Marketplace, el SQL conectado corre bajo `postgres`, no pertenece a `supabase_admin` ni puede asumirlo. Los **16 grants por defecto en futuras tablas** (8 anon, 8 authenticated) persisten. La PR #723 contiene script para **ejecutor genuino `supabase_admin`**, ensayo PostgreSQL 17 aislado con comprobaciones postflight, y documentación para soporte Supabase. Es incorrecto declarar revocado ese residuo o elevar privilegios para forzar su ejecución.

**Nunca** insertar colegios/AMPA reales o ficticios en producción por esta auditoría, ni desplegar automáticamente SQL de ramas antiguas. Ninguna PR DRAFT pendiente está autorizada a abrir funciones de monetización, IA pagada, outbox de correo ni tratamiento de fotos de menores.

La **entrada controlada al piloto** y el **GO para lanzamiento público** son decisiones distintas. Las actas, pruebas con usuarios y datos reales pueden recogerse durante el piloto, pero una apertura sin salvaguardas mínimas de privacidad y autenticación sigue prohibida.
