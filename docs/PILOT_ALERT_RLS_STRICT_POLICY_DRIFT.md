# WETUDY — Preflight RLS de políticas autorizadas, sin tolerar bypass

**11 de noviembre de 2026 · P0 #375.**

Antes, el preflight comprobaba que había una política por propietario y que los grants operativos eran seguros. Sin embargo, PostgreSQL combina mediante **OR** las políticas permisivas. Si alguien añadía otra política `USING (true)`, la política de propietario podía seguir existiendo y el preflight anterior no detectarla.

El nuevo control `scripts/pilot-marketplace-rls-readonly-preflight.sql` incorpora un inventario aprobado de **10 políticas RLS** y coteja para las seis tablas críticas la presencia, el nombre, la operación, los roles y expresiones de `USING` / `WITH CHECK`. **Toda política adicional, eliminada o alterada hace fallar el preflight**, incluidas las excepciones de superadministrador y servicio. Si una política debe cambiar legítimamente, requiere revisión de seguridad y actualización del inventario; la alerta no se desactiva de forma automática.

El SQL se ha vuelto a ejecutar sobre Supabase Education Marketplace en una transacción de **solo lectura**, con resultado PASS. No ha consultado filas personales ni ha modificado permisos.

Se añade una prueba adversarial a PostgreSQL 17 **desechable**, que debe rechazar (1) una política SELECT extra de tipo `USING(true)` en búsquedas, (2) una política DELETE debilitada para coincidencias, y (3) una política SELECT pública nueva para centroides; después de retirar cada cambio malicioso debe recuperar PASS.

**Límite:** comparar metadatos de políticas no equivale a ejecutar Auth/GoTrue real. El ensayo RLS funcional con identidades ficticias permanece separado. No se aplican las cinco migraciones pendientes ni se habilitan avisos o centros. La incidencia #375 sigue abierta.
