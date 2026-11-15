# WETUDY — PR560 · Bloqueo síncrono contra doble guardado del editor
15/11/2026. Cambio mínimo de integridad de las operaciones del navegador, sin SQL ni usuarios reales.

## Hallazgo
El formulario `edit-listing-form.tsx` solo usaba `if (saving) return; setSaving(true)` para impedir dos envíos. React puede retrasar la actualización del estado visible; dos eventos rápidos pueden abrir dos cadenas asíncronas que actualizan listings, suben fotografías y crean/eliminan registros de `listing_photos` en paralelo. La recuperación manual añadida en PR558 tenía el mismo riesgo al usar solo `restoringPhotoMetadata` para evitar dobles pulsaciones.

## Cambio
Dos refs mutables y síncronas (`saveInFlightRef`, `recoveryInFlightRef`) verifican que no hay otra operación activa antes de comenzar. El guardado y la reparación de fotografías se excluyen mutuamente, y la referencia se bloquea **antes** de actualizar la UI y antes de cualquier lectura/escritura. Los bloques `finally` siempre liberan sus locks. Los botones de guardar y cancelar se deshabilitan durante ambas operaciones. La estética, la validación del formulario y el modelo RLS del usuario no cambian.

## Evidencia y limitaciones
Seis contratos Node verifican TSX válido, bloqueo temprano, reentrada, liberación en finally, exclusión mutua y botones deshabilitados. Las comprobaciones son de fuente: no constituyen una prueba de doble clic con un navegador real. Los refs cubren **una pestaña**; dos dispositivos/pestañas simultáneos requieren exclusión transaccional o bloqueo optimista en PostgreSQL, fuera de este alcance.

Se preservan AMPA #245 0/3, recuperación #455 parcial y respaldos del 17/11. No se activan pagos ni piloto general; NO-GO.
