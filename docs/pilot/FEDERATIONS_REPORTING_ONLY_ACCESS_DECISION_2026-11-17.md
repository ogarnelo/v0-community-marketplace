# WETUDY — Federaciones y confederaciones: reporting delegado, sin gestión

Decisión de producto confirmada el 17 de noviembre de 2026.

## Autorización

- `school_admin`: **un solo colegio/AMPA por usuario**. Puede administrar exclusivamente ese centro. El índice `UNIQUE(user_id) WHERE role='school_admin'` propuesto para cerrar carreras en `user_roles` es coherente con esta regla, pero sigue **REVIEW ONLY** y NO autorizado en producción.
- `federation_report_viewer` (nombre técnico **propuesto, todavía no implantado**): acceso exclusivamente de **lectura de informes y KPI**, para FAMPA, federaciones y CEAPA, sobre las AMPAs/colegios con representación validada. Una federación de ámbito superior no adquiere por ubicación acceso a todas las AMPAs de un territorio.
- Posibilidad de filtrado por asociación federada, colegio y periodo. FAMPA ve datos agregados de sus entidades representadas y desglose por colegio; CEAPA puede ver los agregados de su ámbito y desglosar por federación, AMPA y colegio cuando la relación de representación se haya validado.
- No se infieren relaciones de representación solo por nombre, provincia, pertenencia geográfica o dominio de correo. La pertenencia debe registrarse y autorizarse explícitamente, con vigencia, revocación y auditoría.

## Reglas de datos y privacidad

1. **Permisos independientes:** `federation_report_viewer` NO es `school_admin`, `super_admin` ni un atajo para ellos. Un usuario federativo no obtiene acceso a dashboards administrativos operativos.
2. **Denegación por defecto:** los `school_id` consultables se calculan en backend a partir de un mapeo autorizado de representación; no confiar en filtros del navegador ni `school_id` suministrados por el cliente.
3. **KPI agregados con desglose autorizado:** familias registradas, anuncios activos, reutilización de material, donaciones, compraventas, valor circular, impacto ambiental estimado, visualizaciones y tendencias cuando estén respaldados por medidas actuales. Exponer métricas, no filas de usuarios.
4. **Sin acceso al dato personal:** ni nombres, emails, teléfonos, direcciones precisas, mensajes, solicitudes individuales, historial sensible, informes de moderación, documentos o claves. Para colegios o periodos con pocos registros aplicar supresión/umbrales de privacidad; pendiente definir umbral y política jurídica.
5. **Sin modificaciones:** no conceder/retirar roles, invitar usuarios, editar anuncios, aprobar donaciones, alterar pagos, activar correos ni cambiar suscripciones o estados de colegio.
6. **Revocación inmediata:** una relación de representación terminada debe retirarse del conjunto de colegios consultables; auditar cambios de relaciones y accesos federados.
7. **Cálculo coherente de agregados:** sumar/ponderar según naturaleza de cada KPI; no sumar porcentajes ni duplicar familias entre centros o federaciones. Distinguir nivel de colegio, AMPA, federación y confederación.

## Diseño de implementación (pendiente, NO desplegado)

Propuestas de entidades `associations`, `federations`, `association_representation`, `federation_reporting_memberships`, con identificadores internos, vigencia, estado y ámbito. No crear tablas, vistas ni políticas RLS sin diseño y autorización específicos. Evitar mezclar escuela con entidad jurídica AMPA sin verificar el modelo.

Endpoints sugeridos `GET /api/reporting/federations/summary` y `GET /api/reporting/federations/schools/:schoolId`, siempre con autorización de servidor, filtros validados, no-store, minimización de campos y límites de periodo. La función actual `loadSchoolImpactReport` usa cliente privilegiado y datos de detalle: **no llamarla directamente desde una ruta federativa usando un school_id de cliente**. Crear una proyección KPI limitada, después de validar todos los `school_id` representados.

## Estado de este documento

**Es una decisión funcional y de seguridad**, no evidencia de implementación. Hoy `user_roles` solo admite `school_admin` y `super_admin` conforme a su constraint. No existe rol federativo operativo ni las relaciones aprobadas; no inventar acceso de FAMPA/CEAPA. El piloto general sigue NO-GO.
