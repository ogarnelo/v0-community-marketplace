# WETUDY — Auditoría de puntos de entrada SQL con acceso privilegiado

**11/11/2026 · P0 #375.** No se modifican datos, roles ni políticas de producción.

Una revisión de solo metadatos de Supabase Education Marketplace (PostgreSQL 17.6) muestra **37 funciones** en el esquema `public`, de las cuales **17 son `SECURITY DEFINER`**. La consulta de privilegios efectivos `has_function_privilege` no encontró ninguna de esas 17 ejecutable directamente por `anon` ni `authenticated`.

Una búsqueda de cadenas en el cuerpo de las funciones públicas tampoco encontró menciones literales de `TRUNCATE` ni `SET ROLE`. Una de las funciones `SECURITY DEFINER` menciona `EXECUTE` dinámico, lo cual exige cuidado en revisiones futuras. Estos resultados **no son una auditoría de todas las rutas indirectas ni de los esquemas privados**.

El nuevo control `scripts/pilot-client-privilege-function-entrypoints.sql` se puede ejecutar en transacción `READ ONLY`. Cuenta las funciones y falla si se concede `EXECUTE` directo a un rol cliente sobre una función `SECURITY DEFINER` de `public`, o si aparecen tokens literales `TRUNCATE` / `SET ROLE`. Nunca expone definiciones de funciones ni filas personales.

El ensayo `scripts/pilot-client-privilege-function-regression.py` utiliza **otra base efímera PostgreSQL17**, y simula concesiones incorrectas a `anon` y `authenticated`, y una función con SQL `TRUNCATE`, para comprobar que el control falla cerrado y recupera PASS tras corregir el fixture.

**Límites**: el análisis de cadenas no detecta SQL malicioso construido por concatenación, funciones no públicas o vulnerabilidades de la aplicación. La sobreasignación de `TRUNCATE` sigue en producción (48 tablas para `anon`; 49 para `authenticated`), aunque no se haya identificado un punto de entrada directo. No aplicar migraciones ni cambiar permisos hasta aprobación del procedimiento de recuperación y compatibilidad.

P0 #375 continúa abierta. Los seis anuncios DEMO y el envío desactivado no se alteran.
