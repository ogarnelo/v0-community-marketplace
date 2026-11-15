# WETUDY — PR528: control de compatibilidad real y rollback seguro del cambio ACL
Fecha 15/11/2026. **QA solamente. No ejecutar en producción.**

## Catálogo real comprobado sin datos personales
Lecturas SELECT de metadatos en Education Marketplace, public.listings: 36 columnas; anon y authenticated leen 36/36; 33 columnas previstas en la propuesta atómica existen; las tres excluidas son exactamente postal_code, lat y lng. service_role SELECT, authenticated INSERT/UPDATE/DELETE disponibles. anon INSERT/UPDATE/DELETE también concedidos como ACL de tabla (RLS restringe, pero la revocación sigue pendiente). RLS enabled. Cero ACL directos de SELECT/INSERT/UPDATE en columnas para anon/PUBLIC. Políticas listings de SELECT público available y owner/participant; INSERT/UPDATE/DELETE propias authenticated. Fotos tienen políticas SELECT público y escritura propia autenticada dependientes de listings.

## Corrección de la propuesta SQL transaccional existente
El SQL review-only en scripts/pilot-listings-atomic-acl-review-only.sql falla **antes de cualquier REVOKE** si RLS está apagado, si hay grants directos de columna a anon/PUBLIC, si no se cumple el recuento de 36 columnas o si faltan grants iniciales. Las concesiones por columna podrían sobrevivir a un REVOKE de tabla y reabrir CP exacto: no deben pasar desapercibidas.

El corredor PostgreSQL17 local desechable scripts/pilot-listings-atomic-acl-pg17.py cubre camino exitoso y 4 negativos de seguridad: falta SELECT de service_role; esquema con columna extra; concesión SELECT postal_code a anon por columna; RLS apagado. Verifica rechazo, señales explícitas y preservación de ACL en errores. No hay acceso a bases productivas. El workflow pilot-synthetic-db-storage-recovery.yml ejecuta el corredor cuando cambia el script; Critical contracts ejecuta el contrato del preflight.

## Fase de lanzamiento y dependencias
Una precondición de catálogo compatible NO acredita la migración en producción; para aplicarla faltan autorización expresa, plan de rollback y pruebas de frontend/API desplegados con roles reales (anon/public, familias autenticadas, anuncios privados, fotos, edición de CP, conversaciones, búsqueda geo). La rama QA sigue aparte de main y no se debe desplegar automáticamente.

#447 NO-GO hasta cambio y test HTTP autorizados. #245 0/3 AMPA aceptadas. #455 evidencia parcial anterior acreditada; el fundador hará gestión de copias el 17/11. No repetir tareas ya cerradas.
