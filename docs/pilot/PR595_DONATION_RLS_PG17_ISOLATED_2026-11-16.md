# PR595 — Candidata RLS de donaciones verificada en PostgreSQL real y aislado

Esta PR no altera Supabase Education Marketplace. El workflow usa exclusivamente el servicio efímero de GitHub Actions postgres:17, sin secretos ni token productivo. El guion rechaza conexiones que no utilicen 127.0.0.1:5432.

Fixture: dos colegios sintéticos, anuncios disponibles, venta, archivado y sin colegio, roles anon/authenticated y auth.uid() simulada. Primero demuestra (sin datos personales) que la política anterior deja insertar status=approved y school_id erróneo con cuenta autenticada. Después ejecuta el preflight y la candidata PR592 SOLO en la BD desechable. Comprobaciones: dos inserciones válidas, ocho denegaciones de RLS y restricción UNIQUE que evita dos aprobadas de un mismo anuncio.

Corrección preventiva: sustituir la regex ambigua del gate del preflight por clase de espacios POSIX. El archivo candidato sigue fuera de supabase/migrations. No se ejecuta SQL en producción, ni se autoriza la migración con este test. El ensayo NO prueba carreras entre transacciones solapadas, Auth real, Storage, DR ni AMPA. Falta aprobación explícita del responsable antes de aplicar RLS/UNIQUE en Supabase.
