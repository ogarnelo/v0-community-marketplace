# WETUDY — Endurecimiento del ensayo RLS desde copia cifrada

**11/11/2026 · Incidencia P0 #375 · Pruebas aisladas, sin modificación de Supabase.**

La PR #417 restauró **dos** políticas reales de `saved_search_matches` desde el archivo de respaldo en PostgreSQL 17 local. Ahora el mismo ensayo es más estricto: exige que el primer propietario vea y borre su fila ficticia, que no pueda borrar la fila del segundo, que el **segundo propietario** vea solamente su fila y no pueda borrar la primera, y que el rol `authenticated` **sin JWT válido de usuario** no pueda ver ni borrar la fila restante.

Se verifica mediante sesiones y claims sintéticos en un entorno temporal, no mediante usuarios reales. Las dos políticas SQL siguen obteniéndose del backup cifrado real por `pg_restore --schema-only --use-list`; no se restaura ningún dato personal. El resultado falla ante cualquier diferencia y elimina la base de pruebas.

**Límites:** solo se comprueban las dos políticas seleccionadas; no se prueba el resto de las 143 políticas, la recuperación total de GoTrue/Auth, los bytes físicos de Storage, los grants originales del respaldo legado o las siete migraciones sin aplicar. No se activan avisos ni colegios.

Siguiente dependencia principal: nueva copia cifrada con fotografía ACL; el workflow oficial es manual. Mantener #375 abierta.
