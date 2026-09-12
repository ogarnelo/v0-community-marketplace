# MVP Community Agreements UI v1

Este bloque conecta la interfaz de Wetudy con la capa `agreements` creada en Supabase.

## Decisión de producto

Para el MVP, Wetudy no intenta cerrar pagos, envíos ni checkout. El flujo visible se centra en:

```txt
publicar -> contactar -> acordar fuera de Wetudy -> confirmar ambas partes -> valorar/reportar
```

## Qué cambia en la interfaz

- El detalle del anuncio deja de priorizar `Comprar ahora` y `Pago protegido`.
- El CTA principal pasa a ser `Contactar`.
- El chat incorpora un panel de acuerdo.
- Cualquiera de los participantes puede proponer un acuerdo desde el chat.
- Comprador y vendedor confirman por separado.
- Al confirmar ambas partes, el anuncio pasa a vendido o archivado si era donación.
- Después de confirmar, se habilita valoración bilateral.
- Se puede abrir incidencia sobre el acuerdo, usando `reports`.

## Qué se mantiene oculto para MVP

- Checkout.
- Stripe.
- Envíos.
- Compra protegida.
- Transaction velocity.

No se borra código antiguo para no romper arquitectura futura; solo se saca del flujo visible.
