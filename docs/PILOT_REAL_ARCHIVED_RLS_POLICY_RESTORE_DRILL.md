# WETUDY — Restauración real de dos políticas RLS desde backup, con datos sintéticos

**11/11/2026 · Incidencia P0 #375 · Sin restaurar datos personales.**

## Qué comprueba realmente

Las PR #415–416 verificaron que el backup cifrado contiene las 79 tablas de aplicación, las 27 de Auth, las 10 de Storage y 143 políticas RLS catalogadas. **Ninguna de esas comprobaciones ejecutaba SQL de las políticas en una base recuperada.**

`scripts/pilot-real-policy-restore-drill.py` amplía el mismo ensayo cifrado en GitHub Actions:
1. Lee el archivo custom `pg_dump` descifrado dentro del runner temporal, pero **nunca extrae ni restaura datos privados de sus tablas**.
2. Selecciona **exactamente** dos entradas reales de su índice: `saved_search_matches_select_own` (SELECT) y `saved_search_matches_delete_own` (DELETE). Si falta una, hay duplicados o cambia el ámbito, **bloquea**.
3. Verifica que `LOCAL_RESTORE_URL` apunta solamente a `127.0.0.1`/`localhost` en la base temporal esperada. Crea una **segunda** base PostgreSQL17 local que no puede existir previamente.
4. Construye allí una tabla mínima `saved_search_matches`, una función **simulada** `auth.uid()`, roles sin login y dos filas ficticias de familias con UUID de laboratorio.
5. Ejecuta `pg_restore --schema-only --use-list` sobre el **archivo cifrado real** para instalar solo las dos políticas `POLICY`, **sin filas reales, usuarios, sesiones ni otros objetos gestionados**.
6. Comprueba que el rol `authenticated` ve y borra su fila de prueba y que no puede ver ni borrar la fila sintética ajena. Elimina la base local mediante `DROP DATABASE ... WITH (force)` incluso ante error.

## Alcance y límites

Este ensayo demuestra un **subconjunto real de políticas extraídas del backup**, no la restauración de las 140 reglas de `public`, las tres de Storage, sus funciones auxiliares ni de todo el sistema. La función `auth.uid()` y las identidades son **simuladas**: no hay servicio GoTrue recuperado. Las concesiones `GRANT` originales siguen ausentes del backup legado `--no-acl`. No demuestra restauración de archivos de Storage ni de cuentas reales.

**No modificar Supabase, no ejecutar ninguna de las siete migraciones nuevas, no enviar correos, no activar escuelas ni cambiar la UI.** Mantener #375 abierta hasta un backup ACL cifrado reciente, recuperación y pruebas de aislamiento más amplias.
