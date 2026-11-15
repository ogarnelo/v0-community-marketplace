# WETUDY — PR532: minimizar errores sensibles en producción (compra/pago/moderación)
Fecha 15/11/2026. Rama separada basada en main tras PR530; cambios limitados.

## Motivo
Los endpoints productivos de compra directa, preparación de pago y reportes de moderación reflejaban `error.message`/`error.details` de excepciones SQL/Stripe al cliente. Los reportes imprimían también objetos de error completos. La corrección existe y está probada en QA (PR527), pero no fue desplegada con la migración ACL.

## Parche y evidencias
Se reemplazan los 500 por un mensaje fijo y `Cache-Control: private,no-store` y se minimiza el log a un identificador fijo. En buy-now se evita reflejar errores al crear conversación/oferta. Respuestas de éxito con datos de pago o reporte usan no-store. No cambian cálculos, Stripe, privilegios de usuario, estados o pagos reales. Se porta el test Node de QA para tres handlers y tres contratos de fuente, incorporado a Critical contracts de main.

## Límites
No habilita monetización. La privacidad de `public.listings` ya se endureció en migración productiva 20261115180541. El feed público está operativo después de PR530. La aprobación de 3 AMPA (0/3), E2E autenticado real y certificación integral de recuperación no se consideran completados. Las gestiones de copias quedan para día 17 según decisión del fundador.
