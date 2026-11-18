# Puerta de consistencia de informes escolares — 18/11/2026

El informe escolar consulta múltiples relaciones mediante PostgREST. La PR #672 introduce una comprobación adicional: recuentos **exactos y acotados al colegio** de anuncios no demo y acuerdos confirmados en el periodo **antes y después** de la lectura paginada.

**Comportamiento de seguridad:** si el recuento inicial no coincide con el final o con las filas leídas, el informe no se emite (error `SCHOOL_REPORT_CONCURRENT_SOURCE_CHANGE`). Un recuento nulo, inválido o indisponible también se rechaza. Se mantiene el control de estado del colegio al comienzo y al final.

**No es aislamiento de transacción.** Los cambios que conservan el mismo número de filas, ediciones, estados de incidencias y visitas concurrentes pueden escapar a un fence de conteos. Para certificar reporting federativo o histórico bajo concurrencia se necesita una consulta agregada de snapshot consistente (p. ej. una operación SQL única revisada) y pruebas PostgreSQL 17; no se ha aplicado ni autorizado esa migración.

El cambio usa **solo consultas SELECT** dentro de la aplicación existente. No modifica tablas, políticas, grants ni el piloto general.
