# PR #816 — progresión académica (26/11/2026)
- Único bloque activo. Piloto general NO-GO. Activación humana, solo notificación in-app, sin emails ni cron.
- Permiso explícito y revocable `supply_outreach_opt_in`, por defecto false. La tabla actual NO tiene esa columna; SQL candidato review-only pendiente de autorización concreta. Historial de anuncios NO es consentimiento.
- Búsqueda por cursor de propietario: 100 filas por página + una de lookahead; hermanos deduplicados incluso entre páginas; opciones reanudables con presupuesto. No se lee alias, identidad de estudiantes ni emails de Auth.
- API revalida consentimientos, demandantes, informes, contactos en últimos 30 días y colegio/año/curso de cada destinatario, sin repetir las páginas del panel.
- Contacto idempotente: acción reservada antes del aviso, notificación con event_key único y sent_at posterior. DDL del índice único indispensable para proteger carreras; no fusionar antes de instalarlo.
- Próximas puertas: sintéticas/CI completas, autorización del SQL exacto solo Education Marketplace `jpsljmakoscqevssimtk`, instalación con preflight/postflight, opt-in/revocación, preview, merge seguro, producción READY. VM Copilot fuera de alcance.
