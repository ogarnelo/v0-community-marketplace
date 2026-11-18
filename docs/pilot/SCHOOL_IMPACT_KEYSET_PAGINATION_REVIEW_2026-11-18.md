# WETUDY — Paginación keyset del informe escolar

La PR #668 sustituye `range(offset)` por `id > cursor` ordenado con `limit(250)` para anuncios, acuerdos e incidencias acotadas por colegio. Se impide que borrar una fila **antes** del offset provoque el salto de otra fila en la página siguiente. Se rechazan identificadores repetidos, fuera de orden y excesos de 10.000 registros. Los contadores de usuarios continúan usando `head:true, count:exact`.

**Limitación esencial:** keyset evita el desplazamiento de offsets, pero no ofrece una fotografía transaccional si se insertan, modifican o eliminan filas entre consultas. Para un certificado E2E de reporting entre AMPAs sigue siendo necesaria lectura consistente en PostgreSQL, procedimiento agregado auditado o política explícita de consistencia de estadísticas; esto no autoriza automáticamente la migración #649 ni la apertura del piloto.

Datos de prueba sintéticos, sin DDL, usuarios reales, envío de correos o compras.
