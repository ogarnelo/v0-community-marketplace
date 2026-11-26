# PR #816 — continuidad actualizada (26/11/2026)
Único bloque activo; piloto NO-GO, comunicaciones automáticas OFF, VM Copilot fuera de alcance.
- Migración inicial autorizada e instalada en WETUDY jpsljmakoscqevssimtk; RLS intacto, opt-in false, índice único válido.
- QA real revertido: opt-in/revocación, aislamiento entre cuentas, reserva única; cero residuos.
- SHA 40f39765086f5a494a234553db514c2697dfd342: corrección transaccional, CI 45907843733 8/8 SUCCESS, preview dpl_3VaiFPrBkSbiztMgGunqnjEz4zy4 READY.
- Segunda migración p816_atomic_supply_outreach_v2_candidate.sql autorizada, probada con rollback en WETUDY (opt-in, revocación, duplicado, 31 días, ACL y notificaciones); NO instalada definitivamente.
- Se añade harness PG17 local de CI con dos sesiones independientes, sin credenciales productivas. Solo archivos pilot QA/documentación, elegibles para el guard Vercel.
- Pendiente: resultado del harness, CI del HEAD, transición coordinada de DDL y código sin utilizar ruta antigua, producción READY. No lanzar otra rama Supabase ni repetir QA ya acreditada.
