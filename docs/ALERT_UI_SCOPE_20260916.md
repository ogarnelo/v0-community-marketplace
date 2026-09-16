# Alert UI scope guardrail

This PR turns existing demand capture into a visible user action. It does not claim active notifications yet.

Allowed copy:

- `Avísame si aparece`
- `La hemos guardado como señal de demanda.`
- `No enviaremos emails hasta activar las notificaciones.`

Avoid until later:

- `Te avisaremos por email` unless the matching email job exists.
- `Te avisaremos por push` unless push exists.
- Any checkout, payment, shipping or buyer protection wording.
