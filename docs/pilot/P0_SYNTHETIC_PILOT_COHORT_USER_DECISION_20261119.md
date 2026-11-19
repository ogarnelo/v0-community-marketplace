# WETUDY · Piloto con centros y AMPA ficticios hasta el inicio del piloto

Decisión del responsable **19/11/2026**:
- No se esperan colegios o AMPAs *reales* en el entorno hasta que el piloto comience. No convertir ese hecho en una compuerta imposible previa.
- Los ensayos técnicos anteriores al piloto utilizan exclusivamente **colegios, AMPAs, FAMPAs, CEAPA y personas ficticias**, con UUID sintéticos, sin direcciones, emails, nombres ni registros de menores reales.
- Se conservan las pruebas de seguridad automatizadas PostgreSQL 17, API sintética, RLS, Auth simulada y tests de UI; **ninguna fixtura se inserta en el Supabase productivo** como sustituto de la aceptación oficial.
- Las pruebas con centros y AMPA reales, consentimiento y operación end-to-end autenticada real se ejecutarán y documentarán **durante el piloto controlado**. La expansión al público sigue condicionada a su resultado.
- Stripe, profesionales, KYC, cobros live y monetización se aplazan **hasta después del piloto**. Se mantienen los bloqueos y protección existentes para que no se activen accidentalmente.
- Para FAMPA/CEAPA, el acceso es exclusivamente de **reporting agregado para AMPAs representadas**, con filtro colegio, sin acceso operativo. Las fixturas comprueban que CEAPA no ve una escuela de una FAMPA sin cadena de representación y que FAMPA B no puede leer el colegio A.
- Un piloto controlado con colegios reales requiere las decisiones de seguridad/privacidad legales aplicables a sus participantes antes de permitir acceso a sus datos, aunque la certificación final de aceptación sea parte de ese propio piloto.

Estas fixturas viven solo en `__tests__/launch/federation-authority-snapshot-runtime.test.mjs`; no hay pruebas con usuarios ni correo real, API Meta, pagos Stripe o nuevas migraciones remotas. La fecha de lanzamiento público no es sinónimo de empezar el piloto limitado.
