# PR597: dos transacciones PostgreSQL concurrentes (aislado, no Supabase)

16/11/2026. Amplía PR595 con dos sesiones SQL PostgreSQL 17 simultáneas sobre filas diferentes del mismo anuncio ficticio. Ambas inician BEGIN; usan barreras de archivos temporales para solaparse antes de intentar UPDATE status=approved, y se exige un único commit. La otra sesión debe fallar citando el índice parcial de approved. Se comprueba count approved=1. Hay timeouts para no bloquear CI. La tarea solo permite conexión local 127.0.0.1:5432 y no contiene secretos.

Esto valida concurrencia de la restricción UNIQUE en la base de pruebas, no atomicidad de mensajes, pagos o eventos, ni sesiones/DR reales. No aplica DDL productivo ni autoriza SQL en Supabase. La política productiva sigue en revisión P0 #591. Piloto general NO-GO.
